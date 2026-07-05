import {
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type MouseEvent as ReactMouseEvent,
    type ReactNode,
} from "react";

type ColorPickerProps = {
    color: string;
    onChange: (color: string) => void;
};

type RGB = {
    r: number;
    g: number;
    b: number;
};

type HSV = {
    h: number;
    s: number;
    v: number;
};

type Position = {
    x: number;
    y: number;
};

const BASIC_COLORS = [
    "#d0021b",
    "#f5a623",
    "#f8e71c",
    "#8b572a",
    "#7ed321",
    "#417505",
    "#bd10e0",
    "#9013fe",
    "#4a90e2",
    "#50e3c2",
    "#b8e986",
    "#000000",
    "#4a4a4a",
    "#9b9b9b",
    "#ffffff",
];

const SATURATION_WIDTH = 214;
const SATURATION_HEIGHT = 150;

export function ColorPicker({ color, onChange }: ColorPickerProps) {
    const [currentColor, setCurrentColor] = useState(() => transformColor("hex", normalizeHexColor(color)));
    const [inputColor, setInputColor] = useState(currentColor.hex);

    useEffect(() => {
        const transformed = transformColor("hex", normalizeHexColor(color));
        setCurrentColor(transformed);
        setInputColor(transformed.hex);
    }, [color]);

    const saturationPosition = useMemo(() => ({
        x: (currentColor.hsv.s / 100) * SATURATION_WIDTH,
        y: ((100 - currentColor.hsv.v) / 100) * SATURATION_HEIGHT,
    }), [currentColor.hsv.s, currentColor.hsv.v]);

    const huePosition = useMemo(() => ({
        x: (currentColor.hsv.h / 360) * SATURATION_WIDTH,
    }), [currentColor.hsv.h]);

    const setColor = (nextColor: string) => {
        const transformed = transformColor("hex", nextColor);
        setCurrentColor(transformed);
        setInputColor(transformed.hex);
        onChange(transformed.hex);
    };

    const setHexInput = (nextInput: string) => {
        setInputColor(nextInput);
        if (/^#[0-9a-fA-F]{6}$/.test(nextInput)) {
            setColor(nextInput);
        }
    };

    const setSaturation = ({ x, y }: Position) => {
        const transformed = transformColor("hsv", {
            ...currentColor.hsv,
            s: (x / SATURATION_WIDTH) * 100,
            v: 100 - (y / SATURATION_HEIGHT) * 100,
        });
        setCurrentColor(transformed);
        setInputColor(transformed.hex);
        onChange(transformed.hex);
    };

    const setHue = ({ x }: Position) => {
        const transformed = transformColor("hsv", {
            ...currentColor.hsv,
            h: (x / SATURATION_WIDTH) * 360,
        });
        setCurrentColor(transformed);
        setInputColor(transformed.hex);
        onChange(transformed.hex);
    };

    return (
        <div className="sn-color-picker" onMouseDown={(event) => event.preventDefault()}>
            <MoveArea
                className="sn-color-picker-saturation"
                style={{ backgroundColor: `hsl(${currentColor.hsv.h}, 100%, 50%)` }}
                onChange={setSaturation}
            >
                <span
                    className="sn-color-picker-saturation-thumb"
                    style={{
                        backgroundColor: currentColor.hex,
                        left: saturationPosition.x,
                        top: saturationPosition.y,
                    }}
                />
            </MoveArea>

            <MoveArea className="sn-color-picker-hue" onChange={setHue}>
                <span
                    className="sn-color-picker-hue-thumb"
                    style={{ left: huePosition.x }}
                />
            </MoveArea>

            <div className="sn-color-picker-row">
                <span className="sn-color-picker-preview" style={{ backgroundColor: currentColor.hex }} />
                <input
                    className="sn-color-picker-input"
                    aria-label="Hex text color"
                    value={inputColor}
                    spellCheck={false}
                    onMouseDown={(event) => event.stopPropagation()}
                    onChange={(event) => setHexInput(event.target.value)}
                />
            </div>

            <div className="sn-color-picker-basic-grid">
                {BASIC_COLORS.map((basicColor) => (
                    <button
                        key={basicColor}
                        type="button"
                        className="sn-color-picker-basic"
                        style={{ backgroundColor: basicColor }}
                        title={basicColor}
                        aria-label={`Text color ${basicColor}`}
                        onClick={() => setColor(basicColor)}
                    />
                ))}
            </div>
        </div>
    );
}

function MoveArea({
    children,
    className,
    onChange,
    style,
}: {
    children: ReactNode;
    className: string;
    onChange: (position: Position) => void;
    style?: CSSProperties;
}) {
    const areaRef = useRef<HTMLDivElement | null>(null);

    const move = (event: MouseEvent | ReactMouseEvent) => {
        const area = areaRef.current;
        if (!area) return;

        const rect = area.getBoundingClientRect();
        onChange({
            x: clamp(event.clientX - rect.left, rect.width, 0),
            y: clamp(event.clientY - rect.top, rect.height, 0),
        });
    };

    return (
        <div
            ref={areaRef}
            className={className}
            style={style}
            onMouseDown={(event) => {
                if (event.button !== 0) return;
                move(event);

                const onMouseMove = (moveEvent: MouseEvent) => move(moveEvent);
                const onMouseUp = (upEvent: MouseEvent) => {
                    move(upEvent);
                    document.removeEventListener("mousemove", onMouseMove);
                    document.removeEventListener("mouseup", onMouseUp);
                };

                document.addEventListener("mousemove", onMouseMove);
                document.addEventListener("mouseup", onMouseUp);
            }}
        >
            {children}
        </div>
    );
}

function clamp(value: number, max: number, min: number) {
    return value > max ? max : value < min ? min : value;
}

function normalizeHexColor(value: string): string {
    return /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000";
}

function hexToRgb(hex: string): RGB {
    const parts = normalizeHexColor(hex)
        .substring(1)
        .match(/.{2}/g)
        ?.map((part) => parseInt(part, 16)) || [0, 0, 0];

    return {
        r: parts[0],
        g: parts[1],
        b: parts[2],
    };
}

function rgbToHsv({ r, g, b }: RGB): HSV {
    const red = r / 255;
    const green = g / 255;
    const blue = b / 255;
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    const delta = max - min;
    const h = delta === 0
        ? 0
        : max === red
            ? 60 * (((green - blue) / delta) % 6)
            : max === green
                ? 60 * ((blue - red) / delta + 2)
                : 60 * ((red - green) / delta + 4);

    return {
        h: h < 0 ? h + 360 : h,
        s: max === 0 ? 0 : (delta / max) * 100,
        v: max * 100,
    };
}

function hsvToRgb({ h, s, v }: HSV): RGB {
    const saturation = s / 100;
    const value = v / 100;
    const chroma = value * saturation;
    const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
    const match = value - chroma;
    const [red, green, blue] = h < 60
        ? [chroma, x, 0]
        : h < 120
            ? [x, chroma, 0]
            : h < 180
                ? [0, chroma, x]
                : h < 240
                    ? [0, x, chroma]
                    : h < 300
                        ? [x, 0, chroma]
                        : [chroma, 0, x];

    return {
        r: Math.round((red + match) * 255),
        g: Math.round((green + match) * 255),
        b: Math.round((blue + match) * 255),
    };
}

function rgbToHex({ r, g, b }: RGB): string {
    return `#${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function transformColor(format: "hex", color: string): { hex: string; hsv: HSV; rgb: RGB };
function transformColor(format: "hsv", color: HSV): { hex: string; hsv: HSV; rgb: RGB };
function transformColor(format: "hex" | "hsv", color: string | HSV) {
    if (format === "hex") {
        const hex = normalizeHexColor(color as string);
        const rgb = hexToRgb(hex);
        return {
            hex,
            rgb,
            hsv: rgbToHsv(rgb),
        };
    }

    const hsv = color as HSV;
    const rgb = hsvToRgb(hsv);
    return {
        hex: rgbToHex(rgb),
        rgb,
        hsv,
    };
}
