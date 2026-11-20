# CSV Insight Analyzer

A beginner-friendly Python project that reads a CSV sales dataset, cleans and processes the data, calculates useful statistics with NumPy, groups information using dictionaries, and generates a readable insights report.

## Project Requirements

This project covers all seven checklist items:

- [x] Choose a CSV dataset
- [x] Read the CSV using Python
- [x] Clean/process the data
- [x] Calculate at least five useful statistics
- [x] Organize the code into functions
- [x] Upload the project to GitHub
- [x] Write a README with execution instructions

## Features

The program:

1. Reads `data/sales_data.csv` using Python's built-in `csv` module.
2. Converts numeric CSV values into `int`/`float`.
3. Skips invalid or incomplete rows.
4. Calculates revenue after discount.
5. Uses NumPy for:
   - sum
   - mean
   - median
   - maximum
   - minimum
   - standard deviation
6. Uses lists and dictionaries to organize the data.
7. Uses loops to process rows and grouped results.
8. Finds the highest-revenue product.
9. Finds the best-rated product.
10. Calculates revenue by region and category.
11. Counts missing values.
12. Saves the final analysis to `output/insights_report.txt`.

## Project Structure

```text
csv-insight-analyzer/
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

## Requirements

- Python 3.9+
- NumPy

## Installation

Open a terminal inside the project folder.

### 1. Create a virtual environment (recommended)

Windows:

```bash
python -m venv venv
venv\Scripts\activate
```

macOS/Linux:

```bash
python3 -m venv venv
source venv/bin/activate
```

### 2. Install NumPy

```bash
pip install -r requirements.txt
```

## Run the Program

From the project root:

```bash
python main.py
```

The program will read:

```text
data/sales_data.csv
```

and generate:

```text
output/insights_report.txt
```

The main insights are also printed in the terminal.

## Example Analysis

The program calculates more than five statistics, including:

- Total revenue
- Total units sold
- Average units per sale
- Median unit price
- Average customer rating
- Highest single-sale revenue
- Lowest single-sale revenue
- Revenue standard deviation

It also produces grouped insights such as:

- Revenue by region
- Revenue by category
- Units sold by product
- Highest-revenue product
- Best-rated product
- Missing-value counts

## How the Code Works

### `read_csv()`

Reads the CSV file and stores every row as a dictionary.

### `clean_data()`

Converts values such as units sold and prices from strings into numbers and removes invalid rows.

### `calculate_revenue()`

Calculates:

```text
revenue = units_sold × unit_price × (1 - discount/100)
```

### `calculate_statistics()`

Creates NumPy arrays and uses NumPy operations such as `np.sum()`, `np.mean()`, `np.median()`, `np.max()`, `np.min()`, and `np.std()`.

### `group_revenue()`

Uses a dictionary to add revenue for each region, category, or product.

### `build_report()`

Combines all calculated results into a human-readable report.

## Customizing the Dataset

You can replace `data/sales_data.csv` with another CSV if it contains the columns used by the program:

```text
date
product
category
region
units_sold
unit_price
discount_pct
customer_rating
```

If you change the column names, update the corresponding field names in `main.py`.

## GitHub Upload

After testing the program:

```bash
git init
git add .
git commit -m "Add CSV insight analyzer"
git branch -M main
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```

Replace `YOUR_GITHUB_REPOSITORY_URL` with the URL of your GitHub repository.

## Learning Outcomes

This project demonstrates:

- Python file handling
- CSV processing
- Functions
- Loops
- Lists
- Dictionaries
- Data cleaning
- NumPy arrays
- Statistical calculations
- Report generation
- Git and GitHub basics

## License

This project is intended for educational use.
