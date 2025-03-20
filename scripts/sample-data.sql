-- Insertar datos de ejemplo para el sistema de gestión de múltiples negocios

-- Insertar negocios
INSERT INTO businesses (id, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Café Central'),
  ('22222222-2222-2222-2222-222222222222', 'Tech Store'),
  ('33333333-3333-3333-3333-333333333333', 'Fashion Boutique');

-- Insertar empleados
INSERT INTO employees (id, name, email, business_id) VALUES
  ('11111111-aaaa-1111-aaaa-111111111111', 'Juan Pérez', 'juan@example.com', '11111111-1111-1111-1111-111111111111'),
  ('22222222-aaaa-2222-aaaa-222222222222', 'María López', 'maria@example.com', '22222222-2222-2222-2222-222222222222'),
  ('33333333-aaaa-3333-aaaa-333333333333', 'Carlos Rodríguez', 'carlos@example.com', '33333333-3333-3333-3333-333333333333'),
  ('44444444-aaaa-4444-aaaa-444444444444', 'Ana Martínez', 'ana@example.com', '11111111-1111-1111-1111-111111111111');

-- Insertar productos
INSERT INTO products (id, name, code, purchase_price, selling_price, stock, min_stock, description, business_id) VALUES
  ('11111111-bbbb-1111-bbbb-111111111111', 'Café Espresso', 'ESP001', 50, 120, 100, 20, 'Premium coffee beans for espresso', '11111111-1111-1111-1111-111111111111'),
  ('22222222-bbbb-2222-bbbb-222222222222', 'Smartphone X', 'SPX002', 5000, 8500, 15, 5, 'Latest smartphone model', '22222222-2222-2222-2222-222222222222'),
  ('33333333-bbbb-3333-bbbb-333333333333', 'Designer Jeans', 'DJ003', 800, 1500, 30, 10, 'Premium designer jeans', '33333333-3333-3333-3333-333333333333'),
  ('44444444-bbbb-4444-bbbb-444444444444', 'Café Latte', 'LAT004', 60, 150, 80, 15, 'Smooth latte coffee mix', '11111111-1111-1111-1111-111111111111'),
  ('55555555-bbbb-5555-bbbb-555555555555', 'Wireless Earbuds', 'WEB005', 1200, 2500, 25, 8, 'High-quality wireless earbuds', '22222222-2222-2222-2222-222222222222');

-- Insertar turnos
INSERT INTO shifts (id, employee_id, business_id, start_time, end_time) VALUES
  ('11111111-cccc-1111-cccc-111111111111', '11111111-aaaa-1111-aaaa-111111111111', '11111111-1111-1111-1111-111111111111', NOW() - INTERVAL '8 HOURS', NULL),
  ('22222222-cccc-2222-cccc-222222222222', '22222222-aaaa-2222-aaaa-222222222222', '22222222-2222-2222-2222-222222222222', NOW() - INTERVAL '6 HOURS', NULL),
  ('33333333-cccc-3333-cccc-333333333333', '33333333-aaaa-3333-aaaa-333333333333', '33333333-3333-3333-3333-333333333333', NOW() - INTERVAL '7 HOURS', NULL),
  ('44444444-cccc-4444-cccc-444444444444', '44444444-aaaa-4444-aaaa-444444444444', '11111111-1111-1111-1111-111111111111', NOW() - INTERVAL '8 HOURS', NULL),
  ('55555555-cccc-5555-cccc-555555555555', '11111111-aaaa-1111-aaaa-111111111111', '11111111-1111-1111-1111-111111111111', NOW() - INTERVAL '1 DAY' - INTERVAL '8 HOURS', NOW() - INTERVAL '1 DAY');

-- Insertar ventas
INSERT INTO sales (id, business_id, employee_id, shift_id, total, payment_method, timestamp) VALUES
  ('11111111-dddd-1111-dddd-111111111111', '11111111-1111-1111-1111-111111111111', '11111111-aaaa-1111-aaaa-111111111111', '11111111-cccc-1111-cccc-111111111111', 390, 'cash', NOW() - INTERVAL '6 HOURS'),
  ('22222222-dddd-2222-dddd-222222222222', '22222222-2222-2222-2222-222222222222', '22222222-aaaa-2222-aaaa-222222222222', '22222222-cccc-2222-cccc-222222222222', 8500, 'card', NOW() - INTERVAL '4 HOURS'),
  ('33333333-dddd-3333-dddd-333333333333', '33333333-3333-3333-3333-333333333333', '33333333-aaaa-3333-aaaa-333333333333', '33333333-cccc-3333-cccc-333333333333', 3000, 'transfer', NOW() - INTERVAL '5 HOURS'),
  ('44444444-dddd-4444-dddd-444444444444', '11111111-1111-1111-1111-111111111111', '11111111-aaaa-1111-aaaa-111111111111', '11111111-cccc-1111-cccc-111111111111', 360, 'mercadopago', NOW() - INTERVAL '3 HOURS'),
  ('55555555-dddd-5555-dddd-555555555555', '22222222-2222-2222-2222-222222222222', '22222222-aaaa-2222-aaaa-222222222222', '22222222-cccc-2222-cccc-222222222222', 2500, 'rappi', NOW() - INTERVAL '2 HOURS');

-- Insertar items de venta
INSERT INTO sale_items (sale_id, product_id, quantity, price) VALUES
  ('11111111-dddd-1111-dddd-111111111111', '11111111-bbbb-1111-bbbb-111111111111', 2, 120),
  ('11111111-dddd-1111-dddd-111111111111', '44444444-bbbb-4444-bbbb-444444444444', 1, 150),
  ('22222222-dddd-2222-dddd-222222222222', '22222222-bbbb-2222-bbbb-222222222222', 1, 8500),
  ('33333333-dddd-3333-dddd-333333333333', '33333333-bbbb-3333-bbbb-333333333333', 2, 1500),
  ('44444444-dddd-4444-dddd-444444444444', '11111111-bbbb-1111-bbbb-111111111111', 3, 120),
  ('55555555-dddd-5555-dddd-555555555555', '55555555-bbbb-5555-bbbb-555555555555', 1, 2500);

-- Insertar gastos
INSERT INTO expenses (business_id, category, amount, description, date) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Rent', 15000, 'Monthly rent for May', NOW() - INTERVAL '15 DAYS'),
  ('11111111-1111-1111-1111-111111111111', 'Utilities', 3500, 'Electricity bill for April', NOW() - INTERVAL '10 DAYS'),
  ('22222222-2222-2222-2222-222222222222', 'Rent', 25000, 'Monthly rent for May', NOW() - INTERVAL '15 DAYS'),
  ('22222222-2222-2222-2222-222222222222', 'Salaries', 45000, 'Employee salaries for April', NOW() - INTERVAL '5 DAYS'),
  ('33333333-3333-3333-3333-333333333333', 'Suppliers', 35000, 'New inventory payment', NOW() - INTERVAL '3 DAYS');

-- Insertar actividades (asumiendo que ya existen usuarios en la tabla users)
-- Nota: Deberás crear primero los usuarios en la tabla users antes de ejecutar estas inserciones
INSERT INTO activities (user_id, business_id, action, details, timestamp) VALUES
  ('11111111-eeee-1111-eeee-111111111111', '11111111-1111-1111-1111-111111111111', 'Login', 'Admin logged into the system', NOW() - INTERVAL '8 HOURS'),
  ('11111111-aaaa-1111-aaaa-111111111111', '11111111-1111-1111-1111-111111111111', 'Start Shift', 'Employee started a new shift', NOW() - INTERVAL '8 HOURS'),
  ('11111111-aaaa-1111-aaaa-111111111111', '11111111-1111-1111-1111-111111111111', 'New Sale', 'Created a new sale for $390', NOW() - INTERVAL '6 HOURS'),
  ('11111111-eeee-1111-eeee-111111111111', '22222222-2222-2222-2222-222222222222', 'Add Product', 'Added new product: Wireless Earbuds', NOW() - INTERVAL '5 HOURS'),
  ('22222222-aaaa-2222-aaaa-222222222222', '22222222-2222-2222-2222-222222222222', 'New Sale', 'Created a new sale for $8500', NOW() - INTERVAL '4 HOURS');

