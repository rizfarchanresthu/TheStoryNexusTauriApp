import { isTauri } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type DownloadEvent, type Update } from "@tauri-apps/plugin-updater";

export type AppUpdate = Update;

export type UpdateInstallProgress = {
    phase: "started" | "downloading" | "finished";
    downloadedBytes: number;
    contentLength?: number;
};

export function canUseUpdater() {
    return isTauri();
}

export async function checkForAppUpdate() {
    if (!canUseUpdater()) return null;
    return check({ timeout: 30000 });
}

export async function installAppUpdate(
    update: AppUpdate,
    onProgress?: (progress: UpdateInstallProgress) => void
) {
    let downloadedBytes = 0;
    let contentLength: number | undefined;

    await update.downloadAndInstall((event: DownloadEvent) => {
        switch (event.event) {
            case "Started":
                downloadedBytes = 0;
                contentLength = event.data.contentLength;
                onProgress?.({ phase: "started", downloadedBytes, contentLength });
                break;
            case "Progress":
                downloadedBytes += event.data.chunkLength;
                onProgress?.({ phase: "downloading", downloadedBytes, contentLength });
                break;
            case "Finished":
                onProgress?.({ phase: "finished", downloadedBytes, contentLength });
                break;
        }
    });

    await relaunch();
}
