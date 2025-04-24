// DuckDB connection configuration for Evidence.dev
export default {
  // Path to the DuckDB database file
  path: "../duckdb_data/analytics.duckdb",
  // Additional connection options
  options: {
    // Allow loading unsignees extensions
    allow_unsigned_extensions: true,
    // Set read-only mode if needed
    // read_only: false
  }
}