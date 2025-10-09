if (typeof global.Buffer === "undefined") {
  import("buffer").then(({ Buffer }) => {
    global.Buffer = Buffer;
  });
}

if (!("BarcodeDetector" in window)) {
  import("@undecaf/zbar-wasm")
    .then((zbarWasm) => {
      (window as any).BarcodeDetector = class BarcodeDetector {
        constructor(options: any = {}) {}

        async detect(imageData: any) {
          try {
            const results = await zbarWasm.scanRGBABuffer(
              imageData.data || imageData,
              imageData.width,
              imageData.height,
            );
            return results.map((result: any) => ({
              rawValue: result.decode(),
              format: result.typeName,
              boundingBox: result.points
                ? {
                    x: Math.min(...result.points.map((p: any) => p.x)),
                    y: Math.min(...result.points.map((p: any) => p.y)),
                    width:
                      Math.max(...result.points.map((p: any) => p.x)) -
                      Math.min(...result.points.map((p: any) => p.x)),
                    height:
                      Math.max(...result.points.map((p: any) => p.y)) -
                      Math.min(...result.points.map((p: any) => p.y)),
                  }
                : undefined,
            }));
          } catch (error) {
            return [];
          }
        }
      };
    })
    .catch((error) => {
      console.warn("Failed to load zbar-wasm:", error);
      (window as any).BarcodeDetector = class {
        async detect() {
          return [];
        }
      };
    });
}
