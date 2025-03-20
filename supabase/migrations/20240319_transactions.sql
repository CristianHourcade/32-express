-- Función para iniciar una transacción
CREATE OR REPLACE FUNCTION begin_transaction()
RETURNS void AS $$
BEGIN
  -- Iniciar una transacción
  BEGIN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para confirmar una transacción
CREATE OR REPLACE FUNCTION commit_transaction()
RETURNS void AS $$
BEGIN
  -- Confirmar la transacción
  COMMIT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para revertir una transacción
CREATE OR REPLACE FUNCTION rollback_transaction()
RETURNS void AS $$
BEGIN
  -- Revertir la transacción
  ROLLBACK;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

