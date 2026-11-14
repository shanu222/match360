# R8 rules for the Match360 release build.

# --- Capacitor: plugins and their annotated methods are found by reflection ---
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keep class * extends com.getcapacitor.Plugin { *; }
-keepclassmembers class * {
    @com.getcapacitor.annotation.PermissionCallback <methods>;
    @com.getcapacitor.annotation.ActivityCallback <methods>;
    @com.getcapacitor.PluginMethod public <methods>;
    @android.webkit.JavascriptInterface <methods>;
}
-keep class com.getcapacitor.community.admob.** { *; }
-keep class io.capawesome.capacitorjs.plugins.firebase.** { *; }
-keep class com.capacitorjs.plugins.** { *; }
-keep class io.ionic.libs.** { *; }
-keep class org.apache.cordova.** { *; }

# --- Firebase Auth / Google sign-in / Credential Manager (most rules ship with the libraries) ---
-keepattributes Signature, *Annotation*, InnerClasses, EnclosingMethod
-keep class com.google.android.libraries.identity.googleid.** { *; }
-keep class androidx.credentials.playservices.** { *; }
-if class androidx.credentials.CredentialManager
-keep class androidx.credentials.playservices.** { *; }

# --- Google Mobile Ads + UMP consent ---
# No rules here on purpose: both SDKs ship their own R8 rules. A blanket keep on com.google.android.gms.ads
# stopped R8 from shrinking, renaming or optimising about 11,000 classes (two thirds of the app), which is
# what Play Console reports as low DEX code optimisation.

# Move renamed classes into one package: smaller DEX, and what Play Console calls "Repackage classes".
-repackageclasses

# Keep line numbers for readable Play Console crash reports.
-keepattributes SourceFile, LineNumberTable
-renamesourcefileattribute SourceFile

-dontwarn com.facebook.**
-dontwarn com.google.android.gms.games.**
