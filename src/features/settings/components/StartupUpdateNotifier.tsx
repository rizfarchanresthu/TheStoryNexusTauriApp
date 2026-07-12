import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    checkForAppUpdate,
    installAppUpdate,
    type AppUpdate,
    type UpdateInstallProgress,
} from "@/services/updateService";

let hasStartedStartupCheck = false;

export function StartupUpdateNotifier() {
    useEffect(() => {
        if (hasStartedStartupCheck) return;
        hasStartedStartupCheck = true;

        checkForAppUpdate()
            .then((update) => {
                if (!update) return;
                toast.info(<StartupUpdateToast update={update} />, {
                    autoClose: false,
                    closeOnClick: false,
                });
            })
            .catch((error) => {
                console.info("Startup update check skipped:", error);
            });
    }, []);

    return null;
}

function StartupUpdateToast({ update }: { update: AppUpdate }) {
    const [isInstalling, setIsInstalling] = useState(false);
    const [progress, setProgress] = useState<UpdateInstallProgress | null>(null);

    const handleInstall = async () => {
        try {
            setIsInstalling(true);
            await installAppUpdate(update, setProgress);
        } catch (error) {
            console.error("Update install failed:", error);
            toast.error(error instanceof Error ? error.message : "Failed to install update");
            setIsInstalling(false);
        }
    };

    return (
        <div className="space-y-3">
            <div>
                <div className="font-medium">Update {update.version} is available</div>
                <div className="text-sm opacity-80">Current version: {update.currentVersion}</div>
            </div>
            {progress && (
                <div className="text-sm opacity-80">
                    {progress.phase === "finished"
                        ? "Installing update..."
                        : formatProgress(progress)}
                </div>
            )}
            <Button size="sm" onClick={handleInstall} disabled={isInstalling}>
                {isInstalling ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                    <Download className="mr-2 h-4 w-4" />
                )}
                {isInstalling ? "Installing..." : "Install Update"}
            </Button>
        </div>
    );
}

function formatProgress(progress: UpdateInstallProgress) {
    if (!progress.contentLength) {
        return `Downloaded ${formatBytes(progress.downloadedBytes)}`;
    }

    const percent = Math.round((progress.downloadedBytes / progress.contentLength) * 100);
    return `Downloaded ${percent}%`;
}

function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
