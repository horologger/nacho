# Nacho - Bitcoin Handle Keystore

## Project Overview

Nacho is a React Native mobile application built with Expo that serves as a **Bitcoin Handle Keystore**. It's designed to manage Bitcoin handles (similar to usernames) with associated cryptographic keys and certificates. The app provides a secure way to store and manage Bitcoin-related cryptographic data.

### Key Features

- **Keystore Management**: Create new keystores or restore existing ones using mnemonic phrases
- **Handle Management**: Create, view, and manage Bitcoin handles with associated derivation paths
- **Certificate Import**: Import and manage certificates for handles
- **Secure Storage**: Uses platform-specific secure storage (SecureStore on mobile, AsyncStorage on web)
- **Cross-Platform**: Supports iOS, Android, and Web platforms
- **BIP32/BIP39 Support**: Full support for Bitcoin key derivation standards

### Technology Stack

- **Framework**: React Native with Expo SDK 54
- **Navigation**: React Navigation v7
- **Cryptography**: @scure/bip32, @scure/bip39 for Bitcoin key management
- **Storage**: Expo SecureStore (mobile) / AsyncStorage (web)
- **UI**: Custom components with dark theme
- **Language**: TypeScript with strict mode

## Prerequisites

Before building and running this project, ensure you have the following installed:

### Required Software

1. **Node.js** (v18 or later)
   - Download from [nodejs.org](https://nodejs.org/)
   - Verify installation: `node --version`

2. **npm** (comes with Node.js)
   - Verify installation: `npm --version`

3. **Expo CLI**
   ```bash
   npm install -g @expo/cli
   ```

4. **Platform-specific requirements**:

   **For iOS Development:**
   - macOS with Xcode 14 or later
   - iOS Simulator (comes with Xcode)
   - Or physical iOS device with Expo Go app

   **For Android Development:**
   - Android Studio with Android SDK
   - Android Emulator or physical Android device
   - Or physical Android device with Expo Go app

   **For Web Development:**
   - Any modern web browser (Chrome, Firefox, Safari, Edge)

## Installation

1. **Clone the repository** (if not already done):
   ```bash
   git clone <repository-url>
   cd nacho
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Verify installation**:
   ```bash
   npx expo-doctor
   ```

## Development Setup

### Environment Configuration

The project uses Expo's built-in configuration. No additional environment files are required for basic development.

### Development Scripts

The following scripts are available in `package.json`:

- `npm start` - Start the Expo development server
- `npm run android` - Run on Android device/emulator
- `npm run ios` - Run on iOS device/simulator
- `npm run format` - Format code with Prettier

## Building and Running

### Development Mode

1. **Start the development server**:
   ```bash
   npm start
   ```
   This will:
   - Start the Metro bundler
   - Open the Expo DevTools in your browser
   - Display a QR code for mobile testing

2. **Run on different platforms**:

   **Web Browser:**
   - Press `w` in the terminal or click "Run in web browser" in DevTools
   - The app will open in your default browser

   **iOS Simulator:**
   - Press `i` in the terminal or run `npm run ios`
   - Requires Xcode and iOS Simulator

   **Android Emulator:**
   - Press `a` in the terminal or run `npm run android`
   - Requires Android Studio and Android Emulator

   **Physical Device:**
   - Install Expo Go app from App Store/Play Store
   - Scan the QR code displayed in terminal/DevTools

### Production Build

#### Web Build
```bash
npx expo export --platform web
```
The built files will be in the `dist/` directory.

#### Mobile Builds

**iOS Build:**
```bash
npx expo build:ios
```

**Android Build:**
```bash
npx expo build:android
```

**Local Builds (EAS Build):**
```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android
```

## Project Structure

```
nacho/
├── src/
│   ├── App.tsx                 # Main app component
│   ├── Navigation.tsx          # Navigation configuration
│   ├── Store.tsx              # Global state management
│   ├── keys.ts                # Bitcoin key management utilities
│   ├── cert.ts                # Certificate handling
│   ├── file.ts                # File operations
│   ├── screens/
│   │   ├── onboarding/        # Onboarding flow screens
│   │   │   ├── Home.tsx
│   │   │   ├── ShowMnemonic.tsx
│   │   │   ├── ImportKeystore.tsx
│   │   │   └── EnterMnemonic.tsx
│   │   └── main/              # Main app screens
│   │       ├── ListHandles.tsx
│   │       ├── ShowHandle.tsx
│   │       ├── AddHandle.tsx
│   │       └── ImportCertificate.tsx
│   └── ui/                    # Reusable UI components
│       ├── Button.tsx
│       ├── Header.tsx
│       ├── Layout.tsx
│       └── Message.tsx
├── assets/                    # App icons and images
├── app.json                   # Expo configuration
├── package.json              # Dependencies and scripts
└── tsconfig.json             # TypeScript configuration
```

## Key Components

### Store (Global State)
- Manages keystore data (xpub, handles)
- Handles secure storage of private keys
- Provides methods for handle creation/management

### Navigation
- Two main flows: Onboarding and Main app
- Onboarding: New keystore creation or import
- Main: Handle management and certificate import

### Key Management
- BIP39 mnemonic generation and validation
- BIP32 hierarchical deterministic key derivation
- Secure storage using platform-specific APIs

## Security Considerations

- Private keys are stored using platform secure storage
- On mobile: Uses Expo SecureStore with biometric authentication
- On web: Uses AsyncStorage (less secure, development only)
- All cryptographic operations use well-tested libraries (@scure/*)

## Troubleshooting

### Common Issues

1. **Metro bundler issues**:
   ```bash
   npx expo start --clear
   ```

2. **iOS build issues**:
   - Ensure Xcode is up to date
   - Check iOS deployment target in app.json

3. **Android build issues**:
   - Ensure Android SDK is properly configured
   - Check Android target SDK version

4. **Dependency issues**:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

### Development Tips

- Use `npx expo doctor` to check for common issues
- Enable "Fast Refresh" in development for better DX
- Use Expo DevTools for debugging and performance monitoring
- Test on both iOS and Android for platform-specific issues

## Contributing

1. Follow the existing code style (Prettier is configured)
2. Use TypeScript strict mode
3. Test on multiple platforms before submitting changes
4. Ensure all cryptographic operations are properly tested

## License

This project is private and proprietary to Impervious Technologies.


1.
abandon
2.
abandon
3.
abandon
4.
abandon
5.
abandon
6.
abandon
7.
abandon
8.
abandon
9.
abandon
10.
abandon
11.
abandon
12.
about