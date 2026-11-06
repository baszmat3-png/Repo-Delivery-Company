#!/usr/bin/env ruby
# يجهّز مشروع iOS المُولَّد بواسطة Capacitor لمتجر آبل (يُشغَّل على macOS بعد `npx cap add ios`)
# المتغيرات: BUILD_NUMBER, MARKETING_VERSION (اختياري), TEAM_ID (اختياري), HAS_FIREBASE=1 إن وُجد GoogleService-Info.plist
require 'xcodeproj'
require 'fileutils'

root = File.expand_path('..', __dir__)
app_dir = File.join(root, 'ios', 'App')
proj_path = File.join(app_dir, 'App.xcodeproj')
proj = Xcodeproj::Project.open(proj_path)
target = proj.targets.find { |t| t.name == 'App' } or abort 'target App غير موجود'
group = proj.main_group.find_subpath('App', true)
res_phase = target.resources_build_phase

def add_resource(proj, group, res_phase, src, dest_dir)
  dest = File.join(dest_dir, File.basename(src))
  FileUtils.cp(src, dest) unless File.expand_path(src) == File.expand_path(dest)
  return if group.files.any? { |f| f.path == File.basename(src) }
  ref = group.new_file(File.basename(src))
  res_phase.add_file_reference(ref, true)
end

# 1) بيان الخصوصية (إلزامي لدى آبل)
add_resource(proj, group, res_phase, File.join(root, 'ios-resources', 'PrivacyInfo.xcprivacy'), File.join(app_dir, 'App'))

# 2) صلاحية الإشعارات (aps-environment)
ent_path = File.join(app_dir, 'App', 'App.entitlements')
File.write(ent_path, <<~XML)
  <?xml version="1.0" encoding="UTF-8"?>
  <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
  <plist version="1.0">
  <dict>
    <key>aps-environment</key>
    <string>production</string>
  </dict>
  </plist>
XML
group.new_file('App.entitlements') unless group.files.any? { |f| f.path == 'App.entitlements' }

# 3) Firebase (اختياري): GoogleService-Info.plist
if ENV['HAS_FIREBASE'] == '1' && File.exist?(File.join(root, 'GoogleService-Info.plist'))
  add_resource(proj, group, res_phase, File.join(root, 'GoogleService-Info.plist'), File.join(app_dir, 'App'))
end

target.build_configurations.each do |c|
  s = c.build_settings
  s['CODE_SIGN_ENTITLEMENTS'] = 'App/App.entitlements'
  s['TARGETED_DEVICE_FAMILY'] = '1' # آيفون فقط (لا حاجة للقطات آيباد)
  s['IPHONEOS_DEPLOYMENT_TARGET'] = '14.0'
  s['PRODUCT_BUNDLE_IDENTIFIER'] = 'com.rioiraq.express'
  s['MARKETING_VERSION'] = ENV['MARKETING_VERSION'] || '1.0.0'
  s['CURRENT_PROJECT_VERSION'] = ENV['BUILD_NUMBER'] || '1'
  s['DEVELOPMENT_TEAM'] = ENV['TEAM_ID'] if ENV['TEAM_ID'] && !ENV['TEAM_ID'].empty?
  s['ASSETCATALOG_COMPILER_APPICON_NAME'] = 'AppIcon'
end
proj.save

# 4) Info.plist
plist = File.join(app_dir, 'App', 'Info.plist')
pb = '/usr/libexec/PlistBuddy'
def pbset(pb, plist, key, type, val)
  system(pb, '-c', "Delete :#{key}", plist, err: File::NULL, out: File::NULL)
  system(pb, '-c', "Add :#{key} #{type} #{val}", plist) or abort "PlistBuddy فشل: #{key}"
end
pbset(pb, plist, 'CFBundleDisplayName', 'string', 'ريو للتوصيل اسرع')
pbset(pb, plist, 'ITSAppUsesNonExemptEncryption', 'bool', 'false')
pbset(pb, plist, 'NSPhotoLibraryUsageDescription', 'string', 'لاختيار صورتك الشخصية لحسابك في التطبيق.')
pbset(pb, plist, 'NSCameraUsageDescription', 'string', 'لالتقاط صورتك الشخصية لحسابك في التطبيق.')
pbset(pb, plist, 'UIBackgroundModes', 'array', '')
system(pb, '-c', 'Add :UIBackgroundModes:0 string remote-notification', plist)
pbset(pb, plist, 'LSApplicationQueriesSchemes', 'array', '')
%w[whatsapp waze tel].each_with_index { |s, i| system(pb, '-c', "Add :LSApplicationQueriesSchemes:#{i} string #{s}", plist) }
# اتجاه عمودي فقط على آيفون
system(pb, '-c', 'Delete :UISupportedInterfaceOrientations', plist, err: File::NULL, out: File::NULL)
system(pb, '-c', 'Add :UISupportedInterfaceOrientations array', plist)
system(pb, '-c', 'Add :UISupportedInterfaceOrientations:0 string UIInterfaceOrientationPortrait', plist)
system(pb, '-c', 'Delete :UISupportedInterfaceOrientations~ipad', plist, err: File::NULL, out: File::NULL)

# 5) Firebase Messaging: رمز FCM بدل رمز APNs الخام
if ENV['HAS_FIREBASE'] == '1'
  pod = File.join(app_dir, 'Podfile')
  txt = File.read(pod)
  txt.sub!("def capacitor_pods\n", "def capacitor_pods\n  pod 'FirebaseMessaging'\n") unless txt.include?('FirebaseMessaging')
  File.write(pod, txt)
  ad = File.join(app_dir, 'App', 'AppDelegate.swift')
  s = File.read(ad)
  unless s.include?('FirebaseApp.configure')
    s.sub!("import Capacitor\n", "import Capacitor\nimport FirebaseCore\nimport FirebaseMessaging\n")
    s.sub!(/(func application\(_ application: UIApplication, didFinishLaunchingWithOptions[^{]*\{\n)/) { "#{$1}        FirebaseApp.configure()\n" }
    s.sub!("NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)",
           "Messaging.messaging().apnsToken = deviceToken\n        Messaging.messaging().token(completion: { (token, error) in\n            if let error = error {\n                NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)\n            } else if let token = token {\n                NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: token)\n            }\n        })")
    File.write(ad, s)
  end
end
puts 'iOS جاهز'
