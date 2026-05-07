package com.lifelane.lifelane_ai.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import jakarta.mail.internet.MimeMessage;

@Service
public class SmsService {

  private final JavaMailSender mailSender;

  @Value("${spring.mail.username}")
  private String fromEmail;

  public SmsService(JavaMailSender mailSender) {
    this.mailSender = mailSender;
  }

  public boolean sendCrashAlert(String toEmail, String contactName, String driverName, double lat, double lng) {
    if (toEmail == null || toEmail.isBlank()) {
      System.out.println("[EMAIL] Skipping — no email provided");
      return false;
    }

    String mapsUrl = "https://maps.google.com/?q=" + lat + "," + lng;

    try {
      MimeMessage message = mailSender.createMimeMessage();
      MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

      helper.setFrom(fromEmail);
      helper.setTo(toEmail);
      helper.setSubject("🚨 CRASH ALERT — " + driverName + " may need help!");

      String html = """
          <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;background:#0d1b2e;color:#eef5ff;border-radius:16px;overflow:hidden">
            <div style="background:#cc0000;padding:28px 24px;text-align:center">
              <div style="font-size:48px">🚨</div>
              <h1 style="margin:12px 0 4px;color:#fff;font-size:24px;letter-spacing:1px">CRASH ALERT</h1>
              <p style="margin:0;color:rgba(255,255,255,0.85);font-size:14px">LifeLane AI Emergency Notification</p>
            </div>
            <div style="padding:28px 24px">
              <p style="font-size:16px;margin:0 0 20px">Dear <b>%s</b>,</p>
              <p style="font-size:15px;line-height:1.6;margin:0 0 20px">
                <b style="color:#ff6060">%s</b> may have been involved in an accident and needs immediate assistance.
              </p>
              <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,0,0,0.3);border-radius:10px;padding:16px;margin-bottom:20px">
                <div style="font-size:12px;color:rgba(238,245,255,0.5);letter-spacing:2px;margin-bottom:8px">LOCATION</div>
                <div style="font-size:14px">📡 GPS: %.5f, %.5f</div>
              </div>
              <a href="%s" style="display:block;text-align:center;background:#cc0000;color:#fff;text-decoration:none;padding:14px;border-radius:10px;font-weight:bold;font-size:15px;letter-spacing:1px">
                📍 VIEW ON GOOGLE MAPS
              </a>
              <p style="font-size:12px;color:rgba(238,245,255,0.4);text-align:center;margin-top:20px">
                This alert was sent automatically by LifeLane AI crash detection system.<br>
                Please respond immediately.
              </p>
            </div>
          </div>
          """
          .formatted(contactName != null ? contactName : "Emergency Contact",
              driverName, lat, lng, mapsUrl);

      helper.setText(html, true);
      mailSender.send(message);

      System.out.println("[EMAIL] ✅ Crash alert sent to: " + toEmail);
      return true;

    } catch (Exception e) {
      // Print the FULL stack trace so you can see the real reason
      System.err.println("[EMAIL] ❌ Failed to send to " + toEmail + ": " + e.getMessage());
      e.printStackTrace();
      return false;
    }
  }
}
