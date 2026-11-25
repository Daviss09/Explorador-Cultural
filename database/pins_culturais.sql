-- ============================================================================
-- Explorador Cultural — Tabela de Pins Culturais no banco `exploradorcultural`
-- Compatível com MySQL / MariaDB (XAMPP)
-- ============================================================================

CREATE TABLE IF NOT EXISTS `pins_culturais` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `titulo` VARCHAR(80) NOT NULL,
  `descricao` TEXT NOT NULL,
  `categoria` VARCHAR(60) NOT NULL DEFAULT '',
  `cidade` VARCHAR(120) NOT NULL,
  `estado` CHAR(2) NOT NULL,
  `latitude` DECIMAL(9,6) NOT NULL,
  `longitude` DECIMAL(9,6) NOT NULL,
  `usuario_id` INT(11) NULL DEFAULT NULL,
  `criadoEm` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pins_criado_em` (`criadoEm`),
  KEY `idx_pins_estado_cidade` (`estado`, `cidade`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
