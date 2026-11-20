# CSV Insight Analyzer

A beginner-friendly Python mini project that reads a CSV dataset, processes its contents, calculates useful statistics, and produces a simple text report.

This project is part of my personal project collection. It is a hands-on exercise in Python file handling, functions, loops, lists, dictionaries, and basic NumPy operations.

## Project folder

The project is stored in:

`python-date-processing-mini-project/`

## Folder structure

```text
python-date-processing-mini-project/
│
├── data/
│   └── sales_data.csv
│
├── output/
│   └── insights_report.txt
│
├── main.py
├── requirements.txt
├── README.md
└── .gitignore
```

- **`data/`** — input CSV dataset(s) used by the program.
- **`output/`** — generated reports and processed results.
- **`main.py`** — Python program that reads, cleans, analyses, and reports on the CSV data.
- **`requirements.txt`** — Python package dependencies.
- **`.gitignore`** — files and folders Git should ignore.

## What the program does

1. Reads `data/sales_data.csv` using Python's built-in `csv` module.
2. Converts numeric CSV fields into suitable Python number types.
3. Skips rows with invalid numeric values or missing required fields.
4. Calculates each sale's revenue after discount.
5. Uses NumPy to calculate the sum, mean, median, minimum, maximum, and standard deviation of numeric data.
6. Uses loops and dictionaries to group revenue by product, category, and region.
7. Identifies the highest-revenue product and the best-rated product.
8. Checks for missing values.
9. Saves a human-readable summary to `output/insights_report.txt`.

## Dataset columns

The sample sales dataset uses these columns:

| Column | Description |
|---|---|
| `date` | Date of the sale |
| `product` | Product name |
| `category` | Product category |
| `region` | Sales region |
| `units_sold` | Number of units sold |
| `unit_price` | Price per unit |
| `discount_pct` | Discount percentage |
| `customer_rating` | Customer rating |

## Requirements

- Python 3.9 or newer
- NumPy

## Setup and execution

Open a terminal in the `python-date-processing-mini-project` folder.

### 1. Create a virtual environment (recommended)

**Windows:**

```bash
python -m venv venv
venv\\Scripts\\activate
```

**macOS / Linux:**

```bash
python3 -m venv venv
source venv/bin/activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Run the program

```bash
python main.py
```

The program reads the CSV from `data/sales_data.csv`, prints the analysis in the terminal, and writes the report to `output/insights_report.txt`.

## Main statistics and insights

The sample analysis calculates:

- Total revenue and total units sold
- Average units per sale
- Median unit price
- Average customer rating
- Highest and lowest single-sale revenue
- Revenue standard deviation
- Revenue grouped by region and category
- Units sold grouped by product
- Highest-revenue product
- Best-rated product
- Missing-value counts

## Code organization

The program is split into functions so each part has a clear responsibility:

| Function | Purpose |
|---|---|
| `read_csv()` | Reads the CSV file into a list of dictionaries |
| `clean_data()` | Converts numeric fields and skips invalid rows |
| `calculate_revenue()` | Calculates discounted revenue for a row |
| `add_revenue()` | Adds calculated revenue to each row |
| `calculate_statistics()` | Uses NumPy to calculate overall statistics |
| `group_revenue()` | Totals revenue by a selected column |
| `group_units()` | Totals units sold by a selected column |
| `build_report()` | Builds the final text report |
| `save_report()` | Saves the report in the output folder |
| `main()` | Runs the complete analysis workflow |

## Using another CSV file

You can replace `data/sales_data.csv` with your own sales dataset. Keep the expected column names listed above, or update the field names used in `main.py` to match your file.

## Learning goals

This mini project gives practice with:

- Reading files and processing CSV data
- Writing reusable functions
- Using loops, lists, and dictionaries
- Cleaning and converting data
- Creating NumPy arrays
- Performing basic statistical operations
- Generating a report from program results

---

*Built as a practical Python learning project to explore data processing and basic analysis.*
