import sqlite3

def check_all_tables(db_path="sensors.db"):
    # Connect to the SQLite database
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # List of tables to check
    tables = [
        "sensor_readings",
        "sensor_metadata",
        "sensor_aggregated_data",
        "aggregator_state"
    ]
    
    try:
        for table in tables:
            # Get column names for the table
            cursor.execute(f"PRAGMA table_info({table})")
            columns = [column[1] for column in cursor.fetchall()]
            
            # Get first 5 rows
            query = f"SELECT * FROM {table} LIMIT 5"
            cursor.execute(query)
            rows = cursor.fetchall()
            
            print(f"\n{'-'*50}")
            print(f"First 5 rows from {table} table")
            print(f"Columns: {', '.join(columns)}")
            print("-"*50)
            
            if rows:
                for row in rows:
                    print(row)
            else:
                print(f"No data found in {table} table.")
                
    except sqlite3.Error as e:
        print(f"Error querying database: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    check_all_tables()