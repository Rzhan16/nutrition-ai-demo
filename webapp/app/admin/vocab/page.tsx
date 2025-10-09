"use client";

import { useCallback, useEffect, useState } from "react";

interface StatusResponse {
  pointer: {
    version: string | null;
    generatedAt: string | null;
    counts?: {
      entries?: number;
      equivalents?: number;
    };
  };
  recentImports: Array<{
    version: string;
    at: string;
    by: string;
    counts: {
      entries: number;
      equivalents: number;
    };
    sha256: string;
  }>;
  autoLearnHistoryCount: number;
}

export default function AdminVocabPage(): JSX.Element {
  const [token, setToken] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [publishVersion, setPublishVersion] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleTokenChange = (value: string) => {
    setToken(value);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("admin-token", value);
    }
  };

  const fetchStatus = useCallback(
    async (adminToken?: string) => {
      const authToken = adminToken ?? token;
      if (!authToken) {
        setErrorMessage("Provide admin token before fetching status.");
        return;
      }
      setIsLoading(true);
      setErrorMessage(null);
      setStatusMessage(null);
      try {
        const response = await fetch("/api/admin/vocab/status", {
          headers: {
            "X-Admin-Token": authToken,
          },
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || "Failed to fetch status.");
        }
        const payload = (await response.json()) as StatusResponse;
        setStatus(payload);
        if (payload.pointer?.version) {
          setPublishVersion(payload.pointer.version);
        }
        setStatusMessage("Status refreshed.");
      } catch (error) {
        setErrorMessage((error as Error).message);
      } finally {
        setIsLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    const storedToken =
      typeof window !== "undefined"
        ? window.localStorage.getItem("admin-token")
        : null;
    if (storedToken) {
      setToken(storedToken);
      void fetchStatus(storedToken);
    }
  }, [fetchStatus]);

  const handleImport = async () => {
    if (!token) {
      setErrorMessage("Admin token is required.");
      return;
    }
    if (!file) {
      setErrorMessage("Select a CSV or JSON file to import.");
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/admin/vocab/import", {
        method: "POST",
        headers: {
          "X-Admin-Token": token,
        },
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Import failed.");
      }
      setStatusMessage(
        `Imported version ${data.version}. Entries: ${data.previewCounts.entries}, Equivalents: ${data.previewCounts.equivalents}`
      );
      await fetchStatus(token);
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!token) {
      setErrorMessage("Admin token is required.");
      return;
    }
    if (!publishVersion.trim()) {
      setErrorMessage("Provide a version to publish.");
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const response = await fetch(
        `/api/admin/vocab/publish?version=${encodeURIComponent(
          publishVersion.trim()
        )}`,
        {
          method: "POST",
          headers: {
            "X-Admin-Token": token,
          },
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Publish failed.");
      }
      setStatusMessage(`Published version ${data.version}.`);
      await fetchStatus(token);
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Curated Vocabulary Admin</h1>
        <p className="mt-2 text-sm text-gray-600">
          Upload curated vocabularies and manage active versions. All requests
          require the admin token.
        </p>
        <div className="mt-4 flex flex-col gap-3">
          <label className="text-sm font-medium text-gray-700">
            Admin Token
          </label>
          <input
            type="password"
            value={token}
            onChange={(event) => handleTokenChange(event.target.value)}
            placeholder="Enter admin token"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={() => fetchStatus()}
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:bg-gray-400"
            disabled={isLoading}
          >
            Refresh Status
          </button>
          {isLoading && (
            <span className="text-sm text-gray-500">Processing...</span>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Import Curated Data</h2>
        <p className="mt-2 text-sm text-gray-600">
          Upload a CSV (pool,value,alias_of) or JSON payload with entries /
          equivalents. Imports create a staging version that must be published
          manually.
        </p>
        <div className="mt-4 flex flex-col gap-3">
          <input
            type="file"
            accept=".csv,.json,application/json,text/csv"
            onChange={(event) => {
              const selected = event.target.files?.[0] ?? null;
              setFile(selected);
            }}
          />
          {file && (
            <span className="text-sm text-gray-600">
              Selected: {file.name} ({Math.round(file.size / 1024)} KB)
            </span>
          )}
        </div>
        <div className="mt-4">
          <button
            onClick={handleImport}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:bg-blue-300"
            disabled={isLoading}
          >
            Import (staging)
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Publish Version</h2>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="text"
            value={publishVersion}
            onChange={(event) => setPublishVersion(event.target.value)}
            placeholder="curated-YYYYMMDD-HHmmss.json"
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
          <button
            onClick={handlePublish}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500 disabled:bg-green-300"
            disabled={isLoading}
          >
            Publish
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Status</h2>
        {status ? (
          <div className="mt-3 space-y-3 text-sm text-gray-700">
            <div>
              <span className="font-medium">Current Version:</span>{" "}
              {status.pointer.version ?? "Not published"}
            </div>
            <div>
              <span className="font-medium">Published At:</span>{" "}
              {status.pointer.generatedAt ?? "-"}
            </div>
            <div>
              <span className="font-medium">Entries:</span>{" "}
              {status.pointer.counts?.entries ?? 0}
              {" | "}
              <span className="font-medium">Equivalents:</span>{" "}
              {status.pointer.counts?.equivalents ?? 0}
            </div>
            <div>
              <span className="font-medium">Auto-learned tokens:</span>{" "}
              {status.autoLearnHistoryCount}
            </div>
            <div>
              <span className="font-medium">Recent Imports:</span>
              <ul className="mt-2 space-y-1">
                {status.recentImports.length === 0 && (
                  <li className="text-gray-500">No import history.</li>
                )}
                {status.recentImports.map((log) => (
                  <li key={`${log.version}-${log.at}`}>
                    <span className="font-medium">{log.version}</span> —{" "}
                    {new Date(log.at).toLocaleString()} — entries:
                    {log.counts.entries}, equivalents:{log.counts.equivalents}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-gray-600">
            Load status to see the current published version and recent
            imports.
          </p>
        )}
        {statusMessage && (
          <div className="mt-4 rounded-md bg-green-50 px-4 py-2 text-sm text-green-800">
            {statusMessage}
          </div>
        )}
        {errorMessage && (
          <div className="mt-4 rounded-md bg-red-50 px-4 py-2 text-sm text-red-800">
            {errorMessage}
          </div>
        )}
      </section>
    </div>
  );
}
