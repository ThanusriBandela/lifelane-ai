package com.lifelane.lifelane_ai.repository;

import com.lifelane.lifelane_ai.model.Route;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface RouteRepository extends JpaRepository<Route, Long> {}
