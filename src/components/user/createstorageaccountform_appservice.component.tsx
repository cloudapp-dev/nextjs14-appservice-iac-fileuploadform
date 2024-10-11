"use client";
import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import LoadingButton from "@/components/tools/loadingbutton/loadingbutton.component";
import FileUploader from "@/components/azure/storageaccounts/fileuploader.component";
import getStripe from "@/lib/get-stripe";
import { useRouter, useSearchParams } from "next/navigation";

// Utility function to generate a random alphanumeric string
const generateRandomName = (length: number) => {
  const characters = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length }, () =>
    characters.charAt(Math.floor(Math.random() * characters.length))
  ).join("");
};

const CreateStorageAccountFormAppService: React.FC = () => {
  const { data: session } = useSession();
  const user_az_id = session?.user?.sub;
  const user_email = session?.user?.email;
  const token = session?.accessToken;
  const router = useRouter();
  const searchParams = useSearchParams();
  const session_id = searchParams.get("session_id");

  const [resourceGroupName, setResourceGroupName] = useState(
    generateRandomName(24)
  );
  const [accountName, setAccountName] = useState(generateRandomName(24));
  const [location, setLocation] = useState("westeurope");
  const [tags, setTags] = useState({
    env: "production",
    user: user_az_id || "",
  });
  const [containerName, setContainerName] = useState("mycontainer");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [storageAccountName, setStorageAccountName] = useState("");
  const [accessKey, setAccessKey] = useState("");
  const [containers, setContainers] = useState<string[]>([]);
  const [hasStorageAccount, setHasStorageAccount] = useState(false);
  const [paid, setPaid] = useState(false); // Tracks payment status
  const [azureOps, setAzureOps] = useState(""); // Tracks long-running operations (e.g., "create", "delete")
  const [showModal, setShowModal] = useState(false); // Tracks modal visibility

  // Function to check if the user has already paid
  const checkPaymentStatus = async () => {
    const res = await fetch("/api/stripe/check-payment-status");
    const data = await res.json();
    console.log("Payment status:", data.paid);
    setPaid(data.paid);
  };

  // Function to check if the user already has a storage account
  const checkIfUserHasStorageAccount = async () => {
    if (!user_az_id) return;
    try {
      const response = await fetch(
        "/api/azure/storageaccount/check-storage-account",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user_az_id }),
        }
      );
      if (response.ok) {
        const data = await response.json();
        setHasStorageAccount(data.storageAccountName !== "");
        setStorageAccountName(data.storageAccountName);
        setAccessKey(data.accessKey);
        setContainerName(data.containerName || "mycontainer");
        setResourceGroupName(data.resourceGroupName);
      }
    } catch (error) {
      console.error("Error checking storage account existence:", error);
    }
  };

  // Function to fetch the operation status (for long-running processes like creation or deletion)
  // Funktion zum Abrufen des Werts aus der Datenbank
  const fetchData = async () => {
    try {
      const operation = azureOps;
      const value = "status";

      // console.log("Operation: ", operation);

      const responseOps = await fetch("/api/azure/resources/manageoperations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          resourceGroupName,
          operation,
          value,
        }),
      });

      const data = await responseOps.json();

      // console.log("FetchData: ", data);
      // console.log("resourceGroupName: ", resourceGroupName);

      if (azureOps === "create") {
        // console.log("Data: ", data.data.creation);
        if (data.data.creation === "Success") {
          setMessage("Storage account created successfully!");
          setHasStorageAccount(true); // Update the state to reflect the creation
          setLoading(false);
        }
      }
      if (azureOps === "delete") {
        // console.log("Data: ", data.data.deletion);
        if (data.data.deletion === "Success") {
          setMessage("Storage account successfully deleted!");
          setHasStorageAccount(false); // Update the state to reflect the creation
          setLoading(false);
        }
      }
    } catch (error) {
      console.error("Fehler beim Abrufen der Daten:", error);
    }
  };

  // Handle Stripe Payment
  const handlePayment = async () => {
    const res = await fetch("/api/stripe/create-checkout-session", {
      method: "POST",
    });
    const { id } = await res.json();
    const stripe = (await getStripe()) as any;
    const { error } = await stripe.redirectToCheckout({ sessionId: id });
    if (error) console.error("Stripe checkout failed:", error);
    else router.push("/dashboard");
  };

  // Create Storage Account after payment
  const handleCreateStorageAccount = async () => {
    setLoading(true);
    setMessage("");
    setAzureOps("create");
    setContainers([]);

    try {
      let randomName = resourceGroupName;
      const newTags = { env: "production", user: user_az_id };

      // Check if Resource Group Name is empty
      if (resourceGroupName === "") {
        // console.error("Resource Group Name is empty");
        randomName = generateRandomName(24); // Generate a new name
        setResourceGroupName(randomName); // Update the state, but it may not reflect immediately
      }

      // Creating Records in Operationstable
      const operation = "create";
      const value = "pending";

      // Call the function to create a record in the operation table
      const responseOps = await fetch("/api/azure/resources/manageoperations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          resourceGroupName: randomName, // Use the `randomName` directly
          tags: newTags,
          operation,
          value,
        }),
      });

      const response = await fetch(
        "/api/azure/resources/createstorageaccountappservice",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            resourceGroupName: randomName,
            accountName,
            location,
            tags: newTags,
            containerName,
            user_az_id,
            user_email,
          }),
        }
      );
      if (response.ok) {
        const successData = await response.text();
        // setMessage(`Success: ${successData}`);
        checkIfUserHasStorageAccount(); // Refresh account state
      } else {
        const errorData = await response.text();
        setMessage(`Error: ${errorData}`);
      }
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Delete storage account
  const handleDeleteStorageAccount = async () => {
    setLoading(true);
    setMessage("");
    setAzureOps("delete");
    try {
      // Creating Records in Operationstable
      const operation = "delete";
      const value = "pending";

      // Call the function to create a record in the operation table
      const responseOps = await fetch("/api/azure/resources/manageoperations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          resourceGroupName,
          operation,
          value,
        }),
      });

      const response = await fetch(
        "/api/azure/resources/deleteresourcegroupappservice",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            tagKey: "user",
            tagValue: user_az_id,
            user_email,
            resourceGroupName,
          }),
        }
      );
      if (response.ok) {
        const successData = await response.text();
        // setMessage(`Success: ${successData}`);
        checkIfUserHasStorageAccount(); // Refresh account state
      } else {
        const errorData = await response.text();
        setMessage(`Error: ${errorData}`);
      }
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Show confirmation modal before deleting
  const handleShowModal = () => {
    setShowModal(true);
  };

  // Confirm and proceed to delete storage account
  const confirmDeleteStorageAccount = () => {
    setShowModal(false);
    handleDeleteStorageAccount();
  };

  // Close modal without deleting
  const closeModal = () => {
    setShowModal(false);
  };

  useEffect(() => {
    checkIfUserHasStorageAccount();
    checkPaymentStatus();
    if (session_id) {
      fetch(`/api/stripe/success?session_id=${session_id}`)
        .then((res) => res.json())
        .then((data) => {
          console.log(data.message); // Success message
          setMessage(data.message);
        });
    }
  }, [session]);

  // Überwacht Datenbankwertänderungen
  useEffect(() => {
    // Datenbankabfrage alle 5 Sekunden
    if (loading === false) return; // Nur abfragen, wenn der Ladezustand true ist
    const intervalId = setInterval(fetchData, 5000);

    return () => clearInterval(intervalId); // Bereinigen, wenn die Komponente unmontiert wird
  }, [loading === true]);

  return (
    <div className="max-w-lg p-6 mx-auto mt-6 bg-gray-400 rounded-lg shadow-md">
      <h2 className="mb-4 text-2xl font-bold text-center">
        {hasStorageAccount
          ? "You already have a storage account"
          : "Create Storage Account"}
      </h2>

      {!hasStorageAccount && !paid && (
        <button
          onClick={handlePayment}
          className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition mb-4"
        >
          Proceed to Payment
        </button>
      )}

      {!hasStorageAccount && paid && (
        <LoadingButton
          loading={loading}
          onClick={handleCreateStorageAccount}
          startlabel="Create Storage Account"
          loadinglabel="Creating ..."
        />
      )}

      {hasStorageAccount && (
        <>
          <LoadingButton
            loading={loading}
            onClick={handleShowModal}
            startlabel="Deleting Storage Account"
            loadinglabel="Deleting ..."
          />
          <div className="flex justify-center items-center min-h-screen">
            <FileUploader
              storageAccountName={storageAccountName}
              accessKey={accessKey}
              containerName={containerName}
            />
          </div>
        </>
      )}

      {message && (
        <p className="mt-4 text-sm font-medium text-center">{message}</p>
      )}

      {containers.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-lg font-semibold">Containers:</h3>
          <ul className="list-disc list-inside">
            {containers.map((container) => (
              <li className="text-gray-600" key={container}>
                {container}
              </li>
            ))}
          </ul>
        </div>
      )}
      {/* Confirmation Modal */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-75 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md w-full p-6 relative">
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
                Confirm Deletion
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            {/* Modal Body */}
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              Are you sure you want to delete the storage account? This action
              is irreversible.
            </p>
            {/* Modal Footer */}
            <div className="flex justify-end space-x-3">
              <button
                onClick={confirmDeleteStorageAccount}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 focus:ring-4 focus:ring-red-200 dark:focus:ring-red-900"
              >
                Yes, Delete
              </button>
              <button
                onClick={closeModal}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 focus:ring-4 focus:ring-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 dark:focus:ring-gray-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateStorageAccountFormAppService;
