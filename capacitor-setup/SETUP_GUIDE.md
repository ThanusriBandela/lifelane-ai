# LifeLane — Capacitor App Setup Guide

## Prerequisites
- Node.js 18+ installed
- Android Studio installed (for Android APK)
- Xcode installed on Mac (for iOS)

## Step 1 — Install dependencies
```bash
npm install
```

## Step 2 — Add platforms
```bash
npx cap add android
npx cap add ios
```

## Step 3 — Add Android permissions
Open: android/app/src/main/AndroidManifest.xml
Add inside <manifest> tag:
```xml
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
<uses-permission android:name="android.permission.HIGH_SAMPLING_RATE_SENSORS"/>
<uses-permission android:name="android.permission.SEND_SMS"/>
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
```

## Step 4 — Add iOS permissions
Open: ios/App/App/Info.plist
Add inside <dict> tag:
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>LifeLane needs location for emergency routing and crash detection</string>
<key>NSLocationAlwaysUsageDescription</key>
<string>LifeLane needs background location for crash detection while driving</string>
<key>NSMotionUsageDescription</key>
<string>LifeLane uses motion sensors to detect accidents automatically</string>
```

## Step 5 — Point to your backend
Edit capacitor.config.json:
- Local testing: set "url" to "http://YOUR_LOCAL_IP:8080"
- After deployment: set "url" to "https://your-app.onrender.com"

## Step 6 — Sync and build
```bash
npx cap sync

# For Android
npx cap open android
# In Android Studio → Build → Generate Signed APK

# For iOS (Mac only)
npx cap open ios
# In Xcode → Product → Archive
```

## Running backend locally
```bash
./mvnw spring-boot:run
```
Backend runs at: http://localhost:8080
H2 Console: http://localhost:8080/h2-console

## When ready to deploy to Render
See deployment guide — just set these env vars on Render:
- DATABASE_URL (from Render PostgreSQL)
- DB_DRIVER=org.postgresql.Driver
- DB_DIALECT=org.hibernate.dialect.PostgreSQLDialect
- GROQ_API_KEY=your_groq_key
