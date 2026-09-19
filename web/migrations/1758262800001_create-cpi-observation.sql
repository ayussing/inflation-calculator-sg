-- Up Migration
CREATE TABLE cpi_observation (
  series_id integer NOT NULL REFERENCES cpi_series (id) ON DELETE CASCADE,
  period_date date NOT NULL,
  index_value numeric(10,3) NOT NULL,
  PRIMARY KEY (series_id, period_date),
  CONSTRAINT cpi_observation_period_is_month_start
    CHECK (period_date = date_trunc('month', period_date)::date)
);

-- Down Migration
DROP TABLE IF EXISTS cpi_observation;
