# نشر تطبيق «ريو للتوصيل اسرع» على آبل ستور (iOS)

المشروع جاهز للبناء على آيفون: سير العمل `.github/workflows/ios.yml` يبني على أجهزة macOS في GitHub،
وقد جُرّب فعلاً وانتهى بـ `ARCHIVE SUCCEEDED` (أرشيف غير موقّع).

## 1) ما يلزمك أنت (لا يمكن لأحد غيرك إنجازه)
| المطلوب | التفصيل |
|---|---|
| حساب Apple Developer | https://developer.apple.com/programs — **99$ سنوياً**. التسجيل كفرد أو كشركة (الشركة تحتاج رقم D-U-N-S). المراجعة تأخذ من يوم إلى أسبوعين |
| جهاز Mac (اختياري) | غير ضروري: البناء يتم على GitHub. تحتاج Mac فقط إن أردت التجربة على جهازك عبر Xcode |
| معرّف الحزمة (Bundle ID) | `com.rioiraq.delivery` — أنشئه في Certificates, Identifiers & Profiles، وفعّل عليه **Push Notifications** |
| سجل التطبيق في App Store Connect | https://appstoreconnect.apple.com ← Apps ← New App ← الاسم: ريو للتوصيل اسرع ← اللغة: العربية ← Bundle ID ← SKU: `rio-delivery-1` |
| شهادة التوزيع | Apple Distribution (ملف `.p12` + كلمة سره) |
| ملف التوفير | Provisioning Profile نوع **App Store** للمعرّف أعلاه (ملف `.mobileprovision`) |
| مفتاح API (اختياري لرفع تلقائي) | App Store Connect ← Users and Access ← Integrations ← مفتاح بصلاحية App Manager (`.p8` + Key ID + Issuer ID) |
| مفتاح APNs للإشعارات | Certificates, Identifiers & Profiles ← Keys ← مفتاح **Apple Push Notifications service** (`.p8`) ثم ارفعه في Firebase ← Project settings ← Cloud Messaging ← Apple app configuration |
| ملف Firebase لآيفون | Firebase Console ← أضف تطبيق **iOS** بالمعرّف `com.rioiraq.delivery` ← نزّل `GoogleService-Info.plist` |

## 2) أسرار GitHub المطلوبة
Settings ← Secrets and variables ← Actions ← New repository secret:

| اسم السر | المحتوى |
|---|---|
| `APPLE_TEAM_ID` | معرّف الفريق (10 رموز) من حسابك في Apple Developer ← Membership |
| `IOS_CERT_P12_BASE64` | `base64 -i cert.p12` لشهادة Apple Distribution |
| `IOS_CERT_PASSWORD` | كلمة سر ملف p12 |
| `IOS_PROVISION_PROFILE_BASE64` | `base64 -i profile.mobileprovision` |
| `IOS_GOOGLE_SERVICE_INFO_BASE64` | `base64 -i GoogleService-Info.plist` (للإشعارات) |
| `APPSTORE_KEY_ID` / `APPSTORE_ISSUER_ID` / `APPSTORE_KEY_P8_BASE64` | لرفع الملف تلقائياً إلى TestFlight (اختياري) |

بدون `APPLE_TEAM_ID` يبني سير العمل أرشيفاً غير موقّع للتحقق فقط. بعد ضبط الأسرار شغّل
**Actions ← بناء تطبيق iOS (آبل) ← Run workflow**؛ ينتج ملف `App.ipa` (ومن ثم يُرفع لـ TestFlight إن ضبطت مفتاح API).
بدون مفتاح API: ارفع الـ IPA يدوياً بتطبيق **Transporter** (مجاني من Mac App Store).

## 3) ما جُهّز تلقائياً داخل المشروع
- معرّف الحزمة `com.rioiraq.delivery`، آيفون فقط، الحد الأدنى iOS 15، اتجاه عمودي.
- **PrivacyInfo.xcprivacy** (بيان الخصوصية الإلزامي): لا تتبّع، ويصرّح بالبيانات: الاسم، رقم الهاتف، الصورة، المعرّف، معرّف الجهاز، محتوى المستخدم.
- `ITSAppUsesNonExemptEncryption = false` (تشفير HTTPS القياسي فقط) فلا يُسأل عن Export Compliance.
- أوصاف الصلاحيات: الكاميرا ومكتبة الصور (للصورة الشخصية) بالعربية.
- Push Notifications (`aps-environment`) و`UIBackgroundModes: remote-notification`.
- أيقونة 1024×1024 بدون شفافية، مولَّدة من شعارك (`assets/icon-only.png`).
- حذف الحساب داخل التطبيق (مطلوب من آبل، بند 5.1.1): الملف الشخصي ← الأمان.

## 4) بيانات صفحة التطبيق في App Store Connect
- **الاسم** (حتى 30 حرفاً): `ريو للتوصيل اسرع`
- **العنوان الفرعي** (حتى 30): `أسرع توصيل في بغداد`
- **الفئة الأساسية**: Business (أعمال)، والثانوية: Lifestyle أو Navigation
- **التصنيف العمري**: 4+ (لا محتوى حساس). السعر: مجاني
- **الكلمات المفتاحية** (حتى 100 حرف، تفصلها فاصلة): `توصيل,بغداد,طلبات,متجر,سائق,دليفري,مندوب,شحن,تاجر,طرود`
- **رابط سياسة الخصوصية**: https://repo-delivery-company2.onrender.com/privacy.html
- **رابط الدعم** (إلزامي): استخدم رابط الموقع نفسه https://repo-delivery-company2.onrender.com أو صفحة تواصل خاصة بك
- **رابط حذف الحساب** (يُضاف في ملاحظات المراجعة): https://repo-delivery-company2.onrender.com/delete-account.html
- **الوصف**:
  > ريو للتوصيل اسرع: منصة توصيل داخل بغداد تربط التجار بسائقي الدراجات والسيارات. يرفع التاجر طلبه في ثوانٍ، فيصل فوراً لأقرب سائق ويتابع حالته خطوة بخطوة حتى التسليم. للسائق: طلبات متاحة لحظياً، محفظة وكروت شحن، سجل أرباح وتوصيلات، وإشعارات فورية. وصولات قابلة للحفظ والطباعة، وتواصل مباشر بالواتساب ومحادثة داخل كل طلب.
- **لقطات الشاشة** (آيفون 6.7 بوصة، 1290×2796): جاهزة في مجلد `ios-screenshots-6.7in` ضمن حزمة المتجر المرسلة لك.
  آبل تقبل لقطات 6.7 فقط وتصغّرها لبقية الأحجام تلقائياً.

## 5) ملاحظات المراجعة (App Review Information) — مهمة جداً
التطبيق يتطلب تسجيل دخول، لذا يجب إعطاء المراجع حسابات تعمل، وإلا يُرفض:
1. أنشئ من لوحة التحكم حساب تاجر وحساباً لسائق (مفعّلين) وضع بيانهما في خانة Sign-in required (اسم الدخول = رقم الهاتف).
2. اشحن رصيد حساب السائق (5,000 د.ع على الأقل) ليستطيع قبول الطلب، وأضف طلباً تجريبياً معلّقاً.
3. في خانة Notes اكتب:
   > The app is a delivery-logistics platform for Baghdad with three roles (merchant, driver, admin web dashboard). Merchants and drivers are verified by the operator, so new self-registered accounts stay inactive until approved; please use the two demo accounts above. Account deletion: Profile → Security → Delete account (also at <رابط حذف الحساب>). No payments are processed inside the app; the wallet is topped up with prepaid cards sold offline.
4. **بند 4.2 (Minimum Functionality):** آبل ترفض أحياناً التطبيقات التي تبدو كموقع داخل إطار. التطبيق يستخدم إشعارات الدفع الأصلية ونظام محفظة وطلبات لحظية وصورة شخصية، فاذكر ذلك في الملاحظات.
5. **الدفع (بند 3.1.1):** كروت الشحن تُباع خارج التطبيق وهي لخدمة تُستهلك خارجه (رسوم التوصيل)، فلا يلزم شراء داخل التطبيق. وضّح ذلك للمراجع إن سأل.

## 6) أمان البيانات (App Privacy) في App Store Connect
جمع البيانات: **نعم**. لا تتبّع (No tracking). كل البيانات مرتبطة بهوية المستخدم، والغرض: App Functionality فقط.
- Contact Info: الاسم، رقم الهاتف
- User Content: الصورة الشخصية، رسائل المحادثة، بيانات الطلبات (Other User Content)
- Identifiers: User ID، Device ID (رمز الإشعارات)
- Location: لا يُجمع (روابط الخرائط تفتح تطبيقات خارجية فقط)

## 7) خطوات النشر باختصار
1. سجّل في Apple Developer ← أنشئ Bundle ID وفعّل Push.
2. أنشئ التطبيق في App Store Connect.
3. جهّز الشهادة والملف والمفاتيح وأضف الأسرار في GitHub.
4. شغّل سير العمل iOS ← حمّل/ارفع الـ IPA إلى TestFlight.
5. جرّب التطبيق على جوالك عبر TestFlight.
6. املأ صفحة التطبيق (القسم 4) والخصوصية (القسم 6) وملاحظات المراجعة (القسم 5) ← Submit for Review.

> **ملاحظة تقنية:** مسار الإشعارات عبر Firebase على آيفون (يُفعَّل بوجود `IOS_GOOGLE_SERVICE_INFO_BASE64`) مكتوب لكنه لم يُجرَّب على جهاز.
> بدونه يعمل التطبيق بالكامل والإشعارات تصل داخل التطبيق وعند فتحه.
