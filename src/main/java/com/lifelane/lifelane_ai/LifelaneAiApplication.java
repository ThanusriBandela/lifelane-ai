package com.lifelane.lifelane_ai;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class LifelaneAiApplication {
    public static void main(String[] args) {
        SpringApplication.run(LifelaneAiApplication.class, args);
    }
}
