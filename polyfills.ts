if (typeof global.Buffer === "undefined") {
  import("buffer").then(({ Buffer }) => {
    global.Buffer = Buffer;
  });
}

if (typeof global.crypto === "undefined") {
  import("expo-crypto").then(({ getRandomBytes }) => {
    global.crypto = {
      getRandomValues: function (array: any) {
        const bytes = getRandomBytes(array.length);
        for (let i = 0; i < array.length; i++) {
          array[i] = bytes[i];
        }
        return array;
      },
    } as any;
  });
}
