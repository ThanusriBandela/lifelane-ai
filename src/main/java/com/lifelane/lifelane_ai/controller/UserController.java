package com.lifelane.lifelane_ai.controller;

import com.lifelane.lifelane_ai.model.User;
import com.lifelane.lifelane_ai.repository.UserRepository;
import com.lifelane.lifelane_ai.service.SmsService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/users")
@CrossOrigin
public class UserController {

    private final UserRepository userRepo;
    private final SmsService emailService;

    public UserController(UserRepository userRepo, SmsService emailService) {
        this.userRepo = userRepo;
        this.emailService = emailService;
    }

    // ── REGISTER ──────────────────────────────────────────────
    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody User user) {
        if (user.getEmail() == null || user.getEmail().isBlank())
            return ResponseEntity.badRequest().body(Map.of("error", "Email is required"));
        if (userRepo.existsByEmail(user.getEmail()))
            return ResponseEntity.badRequest().body(Map.of("error", "Email already registered"));

        // Trim all contact fields before saving
        if (user.getContact1Email() != null)
            user.setContact1Email(user.getContact1Email().trim());
        if (user.getContact2Email() != null)
            user.setContact2Email(user.getContact2Email().trim());
        if (user.getContact1Name() != null)
            user.setContact1Name(user.getContact1Name().trim());
        if (user.getContact2Name() != null)
            user.setContact2Name(user.getContact2Name().trim());

        User saved = userRepo.save(user);

        // Log what was saved so you can verify in console
        System.out.println("[REGISTER] New user: " + saved.getEmail());
        System.out.println("  Contact 1: " + saved.getContact1Name() + " → " + saved.getContact1Email());
        System.out.println("  Contact 2: " + saved.getContact2Name() + " → " + saved.getContact2Email());

        return ResponseEntity.ok(safeUser(saved));
    }

    // ── LOGIN ─────────────────────────────────────────────────
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        String password = body.get("password");
        if (email == null || password == null)
            return ResponseEntity.badRequest().body(Map.of("error", "Email and password required"));
        Optional<User> opt = userRepo.findByEmail(email);
        if (opt.isEmpty() || !password.equals(opt.get().getPassword()))
            return ResponseEntity.status(401).body(Map.of("error", "Invalid email or password"));

        User u = opt.get();
        System.out.println("[LOGIN] " + u.getEmail()
                + " | c1=" + u.getContact1Email()
                + " | c2=" + u.getContact2Email());

        return ResponseEntity.ok(safeUser(u));
    }

    // ── CRASH ALERT ───────────────────────────────────────────
    @PostMapping("/crash-alert")
    public ResponseEntity<?> crashAlert(
            @RequestParam String email,
            @RequestParam(defaultValue = "0.0") double lat,
            @RequestParam(defaultValue = "0.0") double lng) {

        Optional<User> opt = userRepo.findByEmail(email);
        if (opt.isEmpty())
            return ResponseEntity.badRequest().body(Map.of("error", "User not found: " + email));

        User user = opt.get();
        String driverName = user.getName() != null ? user.getName() : "A LifeLane User";
        int sent = 0;

        System.out.println("═══════════════════════════════════════");
        System.out.println("[CRASH ALERT] Driver: " + driverName + " (" + email + ")");
        System.out.println("  GPS: " + lat + ", " + lng);
        System.out.println("  Contact 1: " + user.getContact1Name() + " → " + user.getContact1Email());
        System.out.println("  Contact 2: " + user.getContact2Name() + " → " + user.getContact2Email());

        // Send to contact 1
        String c1email = user.getContact1Email();
        if (c1email != null && !c1email.isBlank()) {
            boolean ok = emailService.sendCrashAlert(c1email, user.getContact1Name(), driverName, lat, lng);
            System.out.println("  → Contact 1 email " + (ok ? "✅ SENT" : "❌ FAILED") + ": " + c1email);
            if (ok)
                sent++;
        } else {
            System.out.println("  → Contact 1 email SKIPPED (blank)");
        }

        // Send to contact 2
        String c2email = user.getContact2Email();
        if (c2email != null && !c2email.isBlank()) {
            boolean ok = emailService.sendCrashAlert(c2email, user.getContact2Name(), driverName, lat, lng);
            System.out.println("  → Contact 2 email " + (ok ? "✅ SENT" : "❌ FAILED") + ": " + c2email);
            if (ok)
                sent++;
        } else {
            System.out.println("  → Contact 2 email SKIPPED (blank)");
        }

        System.out.println("  Total sent: " + sent + "/2");
        System.out.println("═══════════════════════════════════════");

        String mapsUrl = "https://maps.google.com/?q=" + lat + "," + lng;
        Map<String, Object> resp = new HashMap<>();
        resp.put("status", sent > 0 ? "sent" : "failed");
        resp.put("emailsSent", sent);
        resp.put("driver", driverName);
        resp.put("location", lat + "," + lng);
        resp.put("mapsUrl", mapsUrl);
        resp.put("contact1", c1email != null ? c1email : "");
        resp.put("contact2", c2email != null ? c2email : "");
        return ResponseEntity.ok(resp);
    }

    // ── safeUser — uses HashMap so nulls never crash Map.of() ─
    private Map<String, Object> safeUser(User u) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", u.getId());
        m.put("name", u.getName() != null ? u.getName() : "");
        m.put("email", u.getEmail() != null ? u.getEmail() : "");
        m.put("contact1Name", u.getContact1Name() != null ? u.getContact1Name() : "");
        m.put("contact1Email", u.getContact1Email() != null ? u.getContact1Email() : "");
        m.put("contact2Name", u.getContact2Name() != null ? u.getContact2Name() : "");
        m.put("contact2Email", u.getContact2Email() != null ? u.getContact2Email() : "");
        return m;
    }
}