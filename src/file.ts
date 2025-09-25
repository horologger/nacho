import { Platform } from "react-native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";

export async function save(fileName: string, data: unknown): Promise<void> {
  const content = JSON.stringify(data, null, 2);
  if (Platform.OS === "web") {
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  } else {
    const file = new File(Paths.cache, fileName);
    if (file.exists) {
      await file.delete();
    }
    await file.write(content);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, {
        mimeType: "application/json",
        dialogTitle: "Send file",
      });
    }
  }
}

export async function open(): Promise<unknown> {
  const result = await DocumentPicker.getDocumentAsync({
    type: "application/json",
    multiple: false,
  });

  if (result.canceled) {
    const error = new Error("File selection canceled");
    error.name = "UserCancel";
    throw error;
  }

  const file = result.assets[0];

  if (!file.name?.toLowerCase().endsWith(".json")) {
    throw new Error("Please select a JSON file");
  }

  if (!file.uri) {
    throw new Error("No file URI available");
  }

  const response = await fetch(file.uri);
  const fileContent = await response.text();

  try {
    return JSON.parse(fileContent);
  } catch (error) {
    throw new Error("Invalid JSON format in file");
  }
}
