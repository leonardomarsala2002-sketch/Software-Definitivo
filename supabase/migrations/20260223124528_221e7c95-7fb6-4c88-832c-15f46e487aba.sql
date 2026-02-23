
-- Clean up all existing data (order matters for FK constraints)
TRUNCATE public.time_off_requests CASCADE;
TRUNCATE public.shifts CASCADE;
TRUNCATE public.employee_exceptions CASCADE;
TRUNCATE public.employee_availability CASCADE;
TRUNCATE public.employee_constraints CASCADE;
TRUNCATE public.employee_details CASCADE;
TRUNCATE public.employee_stats CASCADE;
TRUNCATE public.employee_monthly_stats CASCADE;
TRUNCATE public.generation_runs CASCADE;
TRUNCATE public.lending_suggestions CASCADE;
TRUNCATE public.audit_logs CASCADE;
TRUNCATE public.store_coverage_requirements CASCADE;
TRUNCATE public.store_opening_hours CASCADE;
TRUNCATE public.store_shift_allowed_times CASCADE;
TRUNCATE public.store_shift_templates CASCADE;
TRUNCATE public.store_rules CASCADE;
TRUNCATE public.invitations CASCADE;
TRUNCATE public.user_store_assignments CASCADE;
TRUNCATE public.user_roles CASCADE;
TRUNCATE public.profiles CASCADE;
TRUNCATE public.stores CASCADE;

-- Re-seed with 3 stores and 20 employees
DO $$
DECLARE
  s1 uuid := 'a0000001-0000-0000-0000-000000000001';
  s2 uuid := 'a0000001-0000-0000-0000-000000000002';
  s3 uuid := 'a0000001-0000-0000-0000-000000000003';
  v_store_ids uuid[] := ARRAY[s1, s2, s3];

  v_admin_ids uuid[] := ARRAY[
    'b0000001-0000-0000-0000-000000000001',
    'b0000001-0000-0000-0000-000000000002',
    'b0000001-0000-0000-0000-000000000003'
  ];

  v_first_names text[] := ARRAY[
    'Marco','Giulia','Luca','Sara','Andrea','Valentina','Davide','Elisa',
    'Matteo','Chiara','Alessandro','Federica','Simone','Martina','Lorenzo',
    'Alessia','Nicola','Giorgia','Tommaso','Elena'
  ];
  v_last_names text[] := ARRAY[
    'Rossi','Bianchi','Colombo','Ricci','Marino','Greco','Fontana','Conti',
    'De Luca','Costa','Giordano','Mancini','Barbieri','Lombardi','Moretti',
    'Galli','Ferrara','Santoro','Marchetti','Leone'
  ];

  v_emp_idx int := 0;
  v_emp_uuid uuid;
  v_first text;
  v_last text;
  v_dept public.department;
  v_hours int;
  v_day int;
  v_si int;
  v_store uuid;
  v_phone text;
  v_start_h int;
  v_end_h int;
  v_today date := CURRENT_DATE;
  v_monday date;
  v_shift_date date;
  v_email text;
  v_emps_counts int[] := ARRAY[7, 7, 6];

BEGIN
  v_monday := v_today - ((extract(isodow from v_today)::int - 1) || ' days')::interval;

  -- 1. Stores (2 Milano + 1 Roma)
  INSERT INTO stores (id, name, address, city) VALUES
    (s1, 'Store Milano Duomo', 'Piazza del Duomo 1, 20121 Milano', 'Milano'),
    (s2, 'Store Milano Navigli', 'Ripa di Porta Ticinese 7, 20143 Milano', 'Milano'),
    (s3, 'Store Roma Trastevere', 'Via della Lungaretta 15, 00153 Roma', 'Roma');

  -- 2. Admins (profiles + roles + assignments)
  INSERT INTO profiles (id, full_name, email) VALUES
    (v_admin_ids[1], 'Laura Verdi', 'laura.verdi@demo.com'),
    (v_admin_ids[2], 'Giuseppe Russo', 'giuseppe.russo@demo.com'),
    (v_admin_ids[3], 'Francesca Esposito', 'francesca.esposito@demo.com');

  FOR v_si IN 1..3 LOOP
    INSERT INTO user_roles (user_id, role) VALUES (v_admin_ids[v_si], 'admin');
    INSERT INTO user_store_assignments (user_id, store_id, is_primary) VALUES (v_admin_ids[v_si], v_store_ids[v_si], true);
  END LOOP;

  -- 3. Employees (7 + 7 + 6 = 20)
  FOR v_si IN 1..3 LOOP
    v_store := v_store_ids[v_si];

    FOR i IN 1..v_emps_counts[v_si] LOOP
      v_emp_idx := v_emp_idx + 1;
      v_emp_uuid := ('c0000001-0000-0000-0000-' || lpad(v_emp_idx::text, 12, '0'))::uuid;
      v_first := v_first_names[v_emp_idx];
      v_last := v_last_names[v_emp_idx];
      v_email := lower(replace(v_first,' ','')) || '.' || lower(replace(v_last,' ','')) || v_emp_idx || '@demo.com';
      v_dept := CASE WHEN (v_emp_idx % 3) = 0 THEN 'cucina'::public.department ELSE 'sala'::public.department END;
      v_hours := (ARRAY[20, 24, 30, 36, 40])[1 + (v_emp_idx % 5)];
      v_phone := '+39 ' || (330 + (v_emp_idx % 20))::text || ' ' || lpad((1000000 + v_emp_idx * 137)::text, 7, '0');

      INSERT INTO profiles (id, full_name, email) VALUES (v_emp_uuid, v_first || ' ' || v_last, v_email);
      INSERT INTO user_roles (user_id, role) VALUES (v_emp_uuid, 'employee');
      INSERT INTO user_store_assignments (user_id, store_id, is_primary) VALUES (v_emp_uuid, v_store, true);
      INSERT INTO employee_details (user_id, department, weekly_contract_hours, phone) VALUES (v_emp_uuid, v_dept, v_hours, v_phone);

      -- Availability
      v_start_h := CASE WHEN v_dept = 'sala' THEN 10 ELSE 8 END;
      v_end_h := CASE WHEN v_dept = 'sala' THEN 23 ELSE 22 END;
      FOR v_day IN 0..5 LOOP
        IF v_day <> (v_emp_idx % 6) THEN
          INSERT INTO employee_availability (user_id, store_id, day_of_week, start_time, end_time, availability_type)
          VALUES (v_emp_uuid, v_store, v_day, (lpad(v_start_h::text,2,'0')||':00')::time, (lpad(v_end_h::text,2,'0')||':00')::time, 'available');
        END IF;
      END LOOP;

      -- Exceptions for some
      IF (v_emp_idx % 4) = 1 THEN
        INSERT INTO employee_exceptions (user_id, store_id, exception_type, start_date, end_date, notes, created_by) VALUES
          (v_emp_uuid, v_store,
           CASE WHEN (v_emp_idx % 5) = 0 THEN 'malattia'::public.exception_type
                WHEN (v_emp_idx % 5) = 1 THEN 'ferie'::public.exception_type
                ELSE 'permesso'::public.exception_type END,
           v_today + ((v_emp_idx % 14) || ' days')::interval,
           v_today + ((v_emp_idx % 14 + 2) || ' days')::interval,
           CASE WHEN (v_emp_idx % 5) = 0 THEN 'Certificato medico inviato'
                WHEN (v_emp_idx % 5) = 1 THEN 'Ferie programmate'
                ELSE 'Permesso personale' END,
           v_admin_ids[v_si]);
      END IF;

      -- Shifts current week
      FOR v_day IN 0..5 LOOP
        v_shift_date := v_monday + v_day;
        IF v_day = (v_emp_idx % 6) THEN
          INSERT INTO shifts (store_id, user_id, date, department, is_day_off) VALUES (v_store, v_emp_uuid, v_shift_date, v_dept, true);
        ELSE
          IF (v_emp_idx + v_day) % 2 = 0 THEN
            INSERT INTO shifts (store_id, user_id, date, start_time, end_time, department, is_day_off) VALUES (v_store, v_emp_uuid, v_shift_date, '10:00', '15:00', v_dept, false);
          ELSE
            INSERT INTO shifts (store_id, user_id, date, start_time, end_time, department, is_day_off) VALUES (v_store, v_emp_uuid, v_shift_date, '17:00', '23:00', v_dept, false);
          END IF;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  -- 4. Store rules
  FOR v_si IN 1..3 LOOP
    INSERT INTO store_rules (store_id, max_daily_hours_per_employee, max_weekly_hours_per_employee,
      max_daily_team_hours, max_split_shifts_per_employee, mandatory_days_off_per_week,
      generation_enabled, max_split_shifts_per_employee_per_week,
      max_daily_team_hours_cucina, max_daily_team_hours_sala,
      max_team_hours_cucina_per_week, max_team_hours_sala_per_week)
    VALUES (v_store_ids[v_si], 10, 48, 120, 1, 1, true, 3, 50, 70, 300, 420);
  END LOOP;

  -- 5. Opening hours
  FOR v_si IN 1..3 LOOP
    FOR v_day IN 0..6 LOOP
      INSERT INTO store_opening_hours (store_id, day_of_week, opening_time, closing_time)
      VALUES (v_store_ids[v_si], v_day, CASE WHEN v_day = 6 THEN '11:00'::time ELSE '10:00'::time END, '23:59'::time);
    END LOOP;
  END LOOP;

  -- 6. Coverage requirements
  FOR v_si IN 1..3 LOOP
    FOR v_day IN 0..5 LOOP
      FOR v_start_h IN 12..14 LOOP
        INSERT INTO store_coverage_requirements (store_id, day_of_week, hour_slot, department, min_staff_required)
        VALUES (v_store_ids[v_si], v_day, (lpad(v_start_h::text,2,'0')||':00')::time, 'sala', 2 + (v_si % 2));
      END LOOP;
      FOR v_start_h IN 19..22 LOOP
        INSERT INTO store_coverage_requirements (store_id, day_of_week, hour_slot, department, min_staff_required)
        VALUES (v_store_ids[v_si], v_day, (lpad(v_start_h::text,2,'0')||':00')::time, 'sala', 3 + (v_si % 2));
      END LOOP;
      FOR v_start_h IN 11..14 LOOP
        INSERT INTO store_coverage_requirements (store_id, day_of_week, hour_slot, department, min_staff_required)
        VALUES (v_store_ids[v_si], v_day, (lpad(v_start_h::text,2,'0')||':00')::time, 'cucina', 1 + (v_si % 2));
      END LOOP;
      FOR v_start_h IN 18..22 LOOP
        INSERT INTO store_coverage_requirements (store_id, day_of_week, hour_slot, department, min_staff_required)
        VALUES (v_store_ids[v_si], v_day, (lpad(v_start_h::text,2,'0')||':00')::time, 'cucina', 2 + (v_si % 2));
      END LOOP;
    END LOOP;
  END LOOP;

  -- 7. Allowed times
  FOR v_si IN 1..3 LOOP
    FOREACH v_start_h IN ARRAY ARRAY[8,9,10,11,12,17,18,19] LOOP
      INSERT INTO store_shift_allowed_times (store_id, department, hour, kind, is_active) VALUES
        (v_store_ids[v_si], 'sala', v_start_h, 'entry', true),
        (v_store_ids[v_si], 'cucina', v_start_h, 'entry', true);
    END LOOP;
    FOREACH v_end_h IN ARRAY ARRAY[14,15,16,22,23] LOOP
      INSERT INTO store_shift_allowed_times (store_id, department, hour, kind, is_active) VALUES
        (v_store_ids[v_si], 'sala', v_end_h, 'exit', true),
        (v_store_ids[v_si], 'cucina', v_end_h, 'exit', true);
    END LOOP;
  END LOOP;

  -- 8. Time off requests
  FOR v_si IN 1..3 LOOP
    v_store := v_store_ids[v_si];
    FOR i IN 1..3 LOOP
      v_emp_idx := ((v_si - 1) * 7) + i;
      v_emp_uuid := ('c0000001-0000-0000-0000-' || lpad(v_emp_idx::text, 12, '0'))::uuid;
      INSERT INTO time_off_requests (user_id, store_id, request_date, request_type, department, status, notes) VALUES
        (v_emp_uuid, v_store, v_today + (i * 7),
         CASE WHEN i = 1 THEN 'ferie' WHEN i = 2 THEN 'permesso' ELSE 'malattia' END,
         CASE WHEN (v_emp_idx % 3) = 0 THEN 'cucina' ELSE 'sala' END,
         CASE WHEN i = 1 THEN 'pending' WHEN i = 2 THEN 'approved' ELSE 'rejected' END,
         CASE WHEN i = 1 THEN 'Vorrei prendere ferie' WHEN i = 2 THEN 'Visita medica' ELSE 'Impegno personale' END);
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Seed completato: 3 store, 20 dipendenti';
END $$;
