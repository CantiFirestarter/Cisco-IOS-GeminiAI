# Privacy Policy for Cisco IOS AI

**Last Updated: Jan 2026**

## 1. Introduction
Cisco IOS AI ("the App") is a specialized technical utility designed for network engineers. This Privacy Policy outlines how we handle data, ensuring your privacy and data sovereignty are prioritized through a "Local-First" architecture.

## 2. Data Collection and Usage
We do not collect personal information (names, email addresses, or phone numbers) on our own servers. The App operates primarily on your device.

### 2.1 Technical Queries
When you enter CLI commands, network logs, or upload images/files for analysis, this data is sent to **Google Gemini AI** for processing. This data is used solely to generate technical responses and troubleshoot your networking queries.

### 2.2 Local Storage
Your interaction history, configuration preferences, and predictive suggestions are stored locally in your browser's `LocalStorage`. This data stays on your device and is not accessible to us.

## 3. Google Drive Sync
The App offers an optional Cloud Sync feature using Google Drive.

*   **Scope:** If enabled, the App requests access to the `appDataFolder`.
*   **Privacy:** This is a hidden, restricted folder on your Google Drive that is private to your account and this specific App. We (the developers) **cannot** access, read, or modify any files stored in your Google Drive.
*   **Purpose:** This allows you to synchronize your command history across different devices where you use the App.

## 4. Permissions
The App may request the following permissions:
*   **Microphone:** Used only when you explicitly activate the voice-to-command feature. Audio is converted to text locally or via browser APIs.
*   **Camera & Files:** Used only when you choose to upload network diagrams, configuration files, or logs for AI analysis.

## 5. Third-Party Services
The App utilizes the following third-party services:
*   **Google Gemini API:** For generating technical intelligence and synthesizing command syntax.
*   **Google Drive API:** For the optional cross-device synchronization.
*   **Google Search (Grounding):** Used only when "Research Mode" is active to verify syntax against live Cisco documentation.

## 6. Data Deletion and Control
You have full control over your data:
*   **Clear History:** You can delete individual messages or clear your entire local history within the App settings.
*   **Hard Reset:** Using the "Hard Reset Memory" feature will wipe all local data and trigger a deletion request for your hidden cloud sync file on Google Drive.
*   **Google Account:** You can revoke the App's access to your Google account at any time via your Google Security settings.

## 7. Contact
As this is a client-side utility, there is no central data collection point. For technical inquiries regarding the App's architecture, please refer to the project repository.

---
*This policy is subject to change as new features are added. Users are encouraged to review the "Privacy Center" within the App for the latest updates.*