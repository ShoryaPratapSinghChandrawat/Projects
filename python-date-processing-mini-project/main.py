import csv
import os
from collections import Counter, defaultdict

import numpy as np


DATA_FILE = os.path.join("data", "sales_data.csv")
REPORT_FILE = os.path.join("output", "insights_report.txt")


def read_csv(filename):
    """Read the CSV file and return a list of dictionaries."""
    with open(filename, "r", newline="", encoding="utf-8") as file:
        reader = csv.DictReader(file)
        return list(reader)


def clean_data(rows):
    """Convert numeric fields to numbers and remove incomplete rows."""
    cleaned = []

    for row in rows:
        try:
            row["units_sold"] = int(row["units_sold"])
            row["unit_price"] = float(row["unit_price"])
            row["discount_pct"] = float(row["discount_pct"])
            row["customer_rating"] = float(row["customer_rating"])

            if not row["product"] or not row["category"] or not row["region"]:
                continue

            cleaned.append(row)
        except (ValueError, TypeError):
            # Skip rows that contain invalid numeric data.
            continue

    return cleaned


def calculate_revenue(row):
    """Calculate revenue after applying the discount."""
    gross = row["units_sold"] * row["unit_price"]
    discount_amount = gross * (row["discount_pct"] / 100)
    return gross - discount_amount


def add_revenue(rows):
    """Add calculated revenue to every row."""
    for row in rows:
        row["revenue"] = calculate_revenue(row)


def calculate_statistics(rows):
    """Calculate overall statistics using NumPy."""
    units = np.array([row["units_sold"] for row in rows], dtype=float)
    prices = np.array([row["unit_price"] for row in rows], dtype=float)
    ratings = np.array([row["customer_rating"] for row in rows], dtype=float)
    revenue = np.array([row["revenue"] for row in rows], dtype=float)

    return {
        "total_rows": len(rows),
        "total_units": int(np.sum(units)),
        "total_revenue": float(np.sum(revenue)),
        "average_units_per_sale": float(np.mean(units)),
        "median_unit_price": float(np.median(prices)),
        "average_customer_rating": float(np.mean(ratings)),
        "highest_sale_revenue": float(np.max(revenue)),
        "lowest_sale_revenue": float(np.min(revenue)),
        "revenue_std_dev": float(np.std(revenue)),
    }


def group_revenue(rows, field):
    """Return total revenue grouped by a chosen field."""
    totals = defaultdict(float)

    for row in rows:
        totals[row[field]] += row["revenue"]

    return dict(sorted(totals.items(), key=lambda item: item[1], reverse=True))


def group_units(rows, field):
    """Return total units sold grouped by a chosen field."""
    totals = defaultdict(int)

    for row in rows:
        totals[row[field]] += row["units_sold"]

    return dict(sorted(totals.items(), key=lambda item: item[1], reverse=True))


def find_top_product(rows):
    """Find the product with the highest total revenue."""
    product_revenue = group_revenue(rows, "product")
    return next(iter(product_revenue.items()))


def find_best_rating_product(rows):
    """Find the product with the highest average customer rating."""
    ratings = defaultdict(list)

    for row in rows:
        ratings[row["product"]].append(row["customer_rating"])

    averages = {}
    for product, values in ratings.items():
        averages[product] = float(np.mean(np.array(values)))

    return max(averages.items(), key=lambda item: item[1])


def find_missing_values(rows):
    """Count missing values in every column."""
    if not rows:
        return {}

    missing = Counter()

    for row in rows:
        for key, value in row.items():
            if value is None or str(value).strip() == "":
                missing[key] += 1

    return dict(missing)


def build_report(rows):
    """Create a text report containing the most useful insights."""
    stats = calculate_statistics(rows)
    revenue_by_region = group_revenue(rows, "region")
    revenue_by_category = group_revenue(rows, "category")
    units_by_product = group_units(rows, "product")
    top_product, top_product_revenue = find_top_product(rows)
    best_rating_product, best_rating = find_best_rating_product(rows)
    missing = find_missing_values(rows)

    report = []
    report.append("=" * 60)
    report.append("CSV INSIGHT ANALYZER - SALES REPORT")
    report.append("=" * 60)
    report.append("")
    report.append("1. DATASET OVERVIEW")
    report.append(f"Rows analyzed: {stats['total_rows']}")
    report.append(f"Total units sold: {stats['total_units']}")
    report.append("")
    report.append("2. KEY STATISTICS")
    report.append(f"Total revenue: Rs. {stats['total_revenue']:,.2f}")
    report.append(
        f"Average units per sale: {stats['average_units_per_sale']:.2f}"
    )
    report.append(f"Median unit price: Rs. {stats['median_unit_price']:,.2f}")
    report.append(
        f"Average customer rating: {stats['average_customer_rating']:.2f}/5"
    )
    report.append(
        f"Highest single-sale revenue: Rs. {stats['highest_sale_revenue']:,.2f}"
    )
    report.append(
        f"Lowest single-sale revenue: Rs. {stats['lowest_sale_revenue']:,.2f}"
    )
    report.append(
        f"Revenue standard deviation: Rs. {stats['revenue_std_dev']:,.2f}"
    )
    report.append("")
    report.append("3. TOP PRODUCT")
    report.append(
        f"{top_product} generated Rs. {top_product_revenue:,.2f} in revenue."
    )
    report.append("")
    report.append("4. BEST RATED PRODUCT")
    report.append(
        f"{best_rating_product} has the highest average rating: "
        f"{best_rating:.2f}/5."
    )
    report.append("")
    report.append("5. REVENUE BY REGION")
    for region, value in revenue_by_region.items():
        report.append(f"- {region}: Rs. {value:,.2f}")
    report.append("")
    report.append("6. REVENUE BY CATEGORY")
    for category, value in revenue_by_category.items():
        report.append(f"- {category}: Rs. {value:,.2f}")
    report.append("")
    report.append("7. UNITS SOLD BY PRODUCT")
    for product, units in units_by_product.items():
        report.append(f"- {product}: {units} units")
    report.append("")
    report.append("8. DATA QUALITY")
    if missing:
        for column, count in missing.items():
            report.append(f"- {column}: {count} missing values")
    else:
        report.append("- No missing values found.")

    report.append("")
    report.append("9. INSIGHTS")
    report.append(
        f"- {top_product} is the strongest product by revenue."
    )
    top_region = next(iter(revenue_by_region.items()))
    report.append(
        f"- {top_region[0]} is the highest-revenue region "
        f"with Rs. {top_region[1]:,.2f}."
    )
    top_category = next(iter(revenue_by_category.items()))
    report.append(
        f"- {top_category[0]} is the highest-revenue category "
        f"with Rs. {top_category[1]:,.2f}."
    )
    report.append(
        f"- The average customer rating is "
        f"{stats['average_customer_rating']:.2f}/5."
    )
    report.append(
        f"- Revenue varies by about Rs. {stats['revenue_std_dev']:,.2f} "
        f"from the mean, based on the standard deviation."
    )

    return "\n".join(report)


def save_report(report, filename):
    """Save the generated report to a text file."""
    os.makedirs(os.path.dirname(filename), exist_ok=True)

    with open(filename, "w", encoding="utf-8") as file:
        file.write(report)


def main():
    """Run the complete CSV analysis pipeline."""
    print("Reading CSV file...")
    rows = read_csv(DATA_FILE)

    print("Cleaning and processing data...")
    rows = clean_data(rows)

    if not rows:
        raise ValueError("No valid rows were found in the CSV file.")

    add_revenue(rows)

    print("Calculating insights...")
    report = build_report(rows)

    save_report(report, REPORT_FILE)

    print("\nAnalysis complete!")
    print(f"Rows analyzed: {len(rows)}")
    print(f"Report saved to: {REPORT_FILE}")
    print("\n" + report)


if __name__ == "__main__":
    main()
