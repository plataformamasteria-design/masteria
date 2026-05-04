package main

import (
	"database/sql"
	"fmt"
	"os"

	_ "github.com/lib/pq"
)

func main() {
	db, err := sql.Open("postgres", os.Getenv("DATABASE_URL"))
	if err != nil {
		fmt.Println("Error:", err)
		return
	}
	defer db.Close()

	rows, err := db.Query("SELECT id, company_id, config_name, phone, status FROM connections WHERE connection_type = 'baileys' LIMIT 5")
	if err != nil {
		fmt.Println("Query error:", err)
		return
	}
	defer rows.Close()

	fmt.Println("ID | CompanyID | Name | Phone | Status")
	fmt.Println("---|-----------|------|-------|-------")
	for rows.Next() {
		var id, companyID string
		var name, phone, status sql.NullString
		rows.Scan(&id, &companyID, &name, &phone, &status)
		fmt.Printf("%s | %s | %s | %s | %s\n", id, companyID, name.String, phone.String, status.String)
	}
}
