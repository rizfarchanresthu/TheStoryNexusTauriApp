import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, ImageIcon, RotateCcw, Trash2, Upload } from "lucide-react";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/lib/theme-provider";
import { cn } from "@/lib/utils";
import { useStoryContext } from "@/features/stories/context/StoryContext";
import { useStoryStore } from "@/features/stories/stores/useStoryStore";
import { useImageGenerationStore } from "@/features/images/stores/useImageGenerationStore";
import { assetReference, resolveAssetDisplayUrl } from "@/features/images/services/assetStorage";
import {
  CUSTOM_THEME_ID,
  DEFAULT_THEME_SETTINGS,
  THEME_COLOR_FIELDS,
  THEME_PRESETS,
  getEffectivePalette,
  isHexColor,
  type ThemePalette,
  type ThemePreset,
} from "@/features/theme/themePresets";
import type {
  EditorBackgroundFit,
  EditorBackgroundPosition,
  EditorBackgroundSettings,
  MediaAsset,
} from "@/types/story";

export function ThemeSettingsPanel() {
  const { colorThemeSettings, setColorThemeSettings } = useTheme();
  const effectivePalette = getEffectivePalette(colorThemeSettings);
  const isCustom = colorThemeSettings.presetId === CUSTOM_THEME_ID;

  const selectPreset = (preset: ThemePreset) => {
    setColorThemeSettings({
      ...colorThemeSettings,
      presetId: preset.id,
    });
  };

  const selectCustom = () => {
    setColorThemeSettings({
      presetId: CUSTOM_THEME_ID,
      customPalette: colorThemeSettings.customPalette,
    });
  };

  const copyCurrentToCustom = () => {
    setColorThemeSettings({
      presetId: CUSTOM_THEME_ID,
      customPalette: { ...effectivePalette },
    });
  };

  const resetCustom = () => {
    setColorThemeSettings({
      presetId: CUSTOM_THEME_ID,
      customPalette: { ...DEFAULT_THEME_SETTINGS.customPalette },
    });
  };

  const updateCustomColor = (key: keyof ThemePalette, value: string) => {
    if (!isHexColor(value)) return;

    setColorThemeSettings({
      presetId: CUSTOM_THEME_ID,
      customPalette: {
        ...colorThemeSettings.customPalette,
        [key]: value,
      },
    });
  };

  return (
    <div className="space-y-6 p-4">
      <div className="space-y-2">
        <h3 className="text-base font-semibold">Theme Presets</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {THEME_PRESETS.map((preset) => (
            <ThemePresetButton
              key={preset.id}
              name={preset.name}
              description={preset.description}
              palette={preset.palette}
              active={colorThemeSettings.presetId === preset.id}
              onClick={() => selectPreset(preset)}
            />
          ))}
          <ThemePresetButton
            name="Custom"
            description="Tune the app colors yourself."
            palette={colorThemeSettings.customPalette}
            active={isCustom}
            onClick={selectCustom}
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold">Custom Palette</h3>
            <p className="text-sm text-muted-foreground">Changes apply immediately.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={copyCurrentToCustom}>
              <Copy className="mr-2 h-4 w-4" />
              Copy Current
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={resetCustom}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
          </div>
        </div>

        <div className="grid gap-3">
          {THEME_COLOR_FIELDS.map((field) => {
            const value = colorThemeSettings.customPalette[field.key];
            return (
              <div
                key={field.key}
                className={cn(
                  "grid gap-2 rounded-md border border-border p-3 transition-opacity",
                  !isCustom && "opacity-65"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Label htmlFor={`theme-${field.key}`}>{field.label}</Label>
                    <p className="text-xs text-muted-foreground">{field.description}</p>
                  </div>
                  <input
                    id={`theme-${field.key}`}
                    type="color"
                    value={value}
                    disabled={!isCustom}
                    onChange={(event) => updateCustomColor(field.key, event.target.value)}
                    className="h-9 w-12 shrink-0 cursor-pointer rounded border border-border bg-transparent disabled:cursor-not-allowed"
                    aria-label={`${field.label} color`}
                  />
                </div>
                <Input
                  value={value}
                  disabled={!isCustom}
                  readOnly
                  className="font-mono text-xs uppercase"
                />
              </div>
            );
          })}
        </div>
      </div>

      <EditorBackgroundSection />
    </div>
  );
}

const DEFAULT_EDITOR_BACKGROUND: Omit<EditorBackgroundSettings, "assetId"> = {
  enabled: true,
  dim: 0.38,
  fit: "cover",
  position: "center",
};

function EditorBackgroundSection() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { currentStoryId } = useStoryContext();
  const currentStory = useStoryStore((state) => state.currentStory);
  const updateStory = useStoryStore((state) => state.updateStory);
  const { assets, loadGallery, saveUploadedAsset } = useImageGenerationStore();
  const [isUploading, setIsUploading] = useState(false);
  const [localDim, setLocalDim] = useState(DEFAULT_EDITOR_BACKGROUND.dim);

  const background = currentStory?.editorBackground;
  const normalizedBackground: EditorBackgroundSettings = {
    ...DEFAULT_EDITOR_BACKGROUND,
    assetId: background?.assetId,
    enabled: background?.enabled ?? !!background?.assetId,
    dim: background?.dim ?? DEFAULT_EDITOR_BACKGROUND.dim,
    fit: background?.fit ?? DEFAULT_EDITOR_BACKGROUND.fit,
    position: background?.position ?? DEFAULT_EDITOR_BACKGROUND.position,
  };

  const visibleAssets = useMemo(
    () => assets.filter((asset) => !asset.archivedAt),
    [assets],
  );
  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.id === normalizedBackground.assetId),
    [assets, normalizedBackground.assetId],
  );
  const selectedAssetMissing = !!normalizedBackground.assetId && !selectedAsset;

  useEffect(() => {
    if (currentStoryId) {
      loadGallery(currentStoryId).catch(() => undefined);
    }
  }, [currentStoryId, loadGallery]);

  useEffect(() => {
    setLocalDim(normalizedBackground.dim);
  }, [normalizedBackground.dim]);

  const saveEditorBackground = async (updates: Partial<EditorBackgroundSettings>) => {
    if (!currentStory) return;

    const nextBackground: EditorBackgroundSettings = {
      ...normalizedBackground,
      ...updates,
    };

    await updateStory(currentStory.id, {
      editorBackground: nextBackground,
    });
  };

  const handleUpload = async (file: File | undefined) => {
    if (!file || !currentStoryId) return;

    setIsUploading(true);
    try {
      const asset = await saveUploadedAsset({
        storyId: currentStoryId,
        file,
        metadata: { usage: "editor background" },
      });
      await saveEditorBackground({
        assetId: asset.id,
        enabled: true,
      });
      toast.success("Editor background uploaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload background");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeBackground = async () => {
    await saveEditorBackground({
      assetId: undefined,
      enabled: false,
    });
    toast.success("Editor background removed");
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-base font-semibold">Editor Background</h3>
        <p className="text-sm text-muted-foreground">Applies to this story's writing area only.</p>
      </div>

      {!currentStoryId ? (
        <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
          Choose a story to set an editor background.
        </div>
      ) : (
        <div className="space-y-4 rounded-md border border-border bg-surface p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              <Upload className="mr-2 h-4 w-4" />
              {isUploading ? "Uploading..." : "Upload Image"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => handleUpload(event.target.files?.[0])}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={removeBackground}
              disabled={!normalizedBackground.assetId}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Remove
            </Button>
          </div>

          <div className="grid gap-2">
            <Label>Story Image</Label>
            <Select
              value={normalizedBackground.assetId}
              onValueChange={(assetId) => saveEditorBackground({ assetId, enabled: true })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a saved image" />
              </SelectTrigger>
              <SelectContent>
                {visibleAssets.length === 0 ? (
                  <SelectItem value="no-images" disabled>
                    No images available
                  </SelectItem>
                ) : (
                  visibleAssets.map((asset) => (
                    <SelectItem key={asset.id} value={asset.id}>
                      {asset.filename}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {selectedAsset || selectedAssetMissing ? (
            <div className="overflow-hidden rounded-md border border-border bg-background">
              {selectedAsset ? (
                <EditorBackgroundPreview asset={selectedAsset} />
              ) : (
                <div className="flex h-36 items-center justify-center text-sm text-muted-foreground">
                  Selected image is unavailable.
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              <ImageIcon className="mx-auto mb-2 h-8 w-8 opacity-60" />
              No editor background selected.
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <div>
              <Label htmlFor="editor-background-enabled">Show Background</Label>
              <p className="text-xs text-muted-foreground">Keep the uploaded image without displaying it.</p>
            </div>
            <Switch
              id="editor-background-enabled"
              checked={normalizedBackground.enabled && !!normalizedBackground.assetId}
              disabled={!normalizedBackground.assetId}
              onCheckedChange={(enabled) => saveEditorBackground({ enabled })}
            />
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-3">
              <Label>Dim</Label>
              <span className="text-xs text-muted-foreground">{Math.round(localDim * 100)}%</span>
            </div>
            <Slider
              value={[Math.round(localDim * 100)]}
              min={0}
              max={92}
              step={1}
              disabled={!normalizedBackground.assetId}
              onValueChange={([value]) => setLocalDim(value / 100)}
              onValueCommit={([value]) => saveEditorBackground({ dim: value / 100 })}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Fit</Label>
              <Select
                value={normalizedBackground.fit}
                onValueChange={(fit: EditorBackgroundFit) => saveEditorBackground({ fit })}
                disabled={!normalizedBackground.assetId}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cover">Cover</SelectItem>
                  <SelectItem value="contain">Contain</SelectItem>
                  <SelectItem value="contain-repeat">Contain Repeat</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Position</Label>
              <Select
                value={normalizedBackground.position}
                onValueChange={(position: EditorBackgroundPosition) => saveEditorBackground({ position })}
                disabled={!normalizedBackground.assetId}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="top">Top</SelectItem>
                  <SelectItem value="bottom">Bottom</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditorBackgroundPreview({ asset }: { asset: MediaAsset }) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    let cancelled = false;
    resolveAssetDisplayUrl(assetReference(asset.id))
      .then((resolved) => {
        if (!cancelled) setUrl(resolved);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [asset.id]);

  if (!url) {
    return (
      <div className="flex h-36 items-center justify-center text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={asset.filename}
      className="h-36 w-full object-cover"
    />
  );
}

function ThemePresetButton({
  name,
  description,
  palette,
  active,
  onClick,
}: {
  name: string;
  description: string;
  palette: ThemePalette;
  active: boolean;
  onClick: () => void;
}) {
  const swatches = [
    palette.background,
    palette.surface,
    palette.primary,
    palette.secondary,
    palette.accent,
  ];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-28 rounded-md border p-3 text-left transition-colors hover:border-primary/70 hover:bg-elevated",
        active ? "border-primary bg-primary/10" : "border-border bg-surface"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{name}</div>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
            {description}
          </p>
        </div>
        {active && <Check className="h-4 w-4 shrink-0 text-primary" />}
      </div>
      <div className="mt-3 flex overflow-hidden rounded border border-border">
        {swatches.map((swatch, index) => (
          <span
            key={`${swatch}-${index}`}
            className="h-6 flex-1"
            style={{ backgroundColor: swatch }}
          />
        ))}
      </div>
    </button>
  );
}
