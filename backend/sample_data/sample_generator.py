import os
import numpy as np
import pandas as pd

def generate_samples(output_dir: str):
    os.makedirs(output_dir, exist_ok=True)
    np.random.seed(42)

    # 1. Telecom Customer Churn (Classification)
    n_churn = 750
    customer_ids = [f"CUST-{1000 + i}" for i in range(n_churn)]
    genders = np.random.choice(["Male", "Female"], size=n_churn)
    seniors = np.random.choice([0, 1], p=[0.85, 0.15], size=n_churn)
    partners = np.random.choice(["Yes", "No"], p=[0.5, 0.5], size=n_churn)
    dependents = np.random.choice(["Yes", "No"], p=[0.3, 0.7], size=n_churn)
    tenure = np.random.randint(1, 72, size=n_churn)
    phone_svc = np.random.choice(["Yes", "No"], p=[0.9, 0.1], size=n_churn)
    internet_svc = np.random.choice(["Fiber optic", "DSL", "No"], p=[0.45, 0.35, 0.2], size=n_churn)
    contract = np.random.choice(["Month-to-month", "One year", "Two year"], p=[0.55, 0.25, 0.20], size=n_churn)
    payment = np.random.choice(["Electronic check", "Mailed check", "Bank transfer", "Credit card"], size=n_churn)
    
    monthly_charges = np.where(
        internet_svc == "Fiber optic",
        np.random.uniform(70, 115, size=n_churn),
        np.where(internet_svc == "DSL", np.random.uniform(40, 75, size=n_churn), np.random.uniform(18, 28, size=n_churn))
    ).round(2)
    
    total_charges = (monthly_charges * tenure + np.random.normal(0, 15, size=n_churn)).round(2)
    total_charges = np.maximum(total_charges, monthly_charges)

    # Synthetic churn probability logic
    churn_prob = 0.15 + (contract == "Month-to-month") * 0.35 + (internet_svc == "Fiber optic") * 0.20 - (tenure / 72) * 0.35 + (monthly_charges > 80) * 0.15
    churn_prob = np.clip(churn_prob, 0.05, 0.90)
    churn = ["Yes" if np.random.rand() < p else "No" for p in churn_prob]

    churn_df = pd.DataFrame({
        "CustomerID": customer_ids,
        "Gender": genders,
        "SeniorCitizen": seniors,
        "Partner": partners,
        "Dependents": dependents,
        "TenureMonths": tenure,
        "PhoneService": phone_svc,
        "InternetService": internet_svc,
        "Contract": contract,
        "PaymentMethod": payment,
        "MonthlyCharges": monthly_charges,
        "TotalCharges": total_charges,
        "Churn": churn
    })

    # Add a few realistic missing values and an outlier
    churn_df.loc[np.random.choice(n_churn, size=12, replace=False), "TotalCharges"] = np.nan
    churn_df.loc[np.random.choice(n_churn, size=5, replace=False), "InternetService"] = np.nan
    churn_df.to_csv(os.path.join(output_dir, "telecom_customer_churn.csv"), index=False)

    # 2. Real Estate Housing (Regression)
    n_house = 600
    sqft = np.random.normal(2100, 600, size=n_house).astype(int)
    sqft = np.clip(sqft, 800, 5000)
    bedrooms = np.random.choice([1, 2, 3, 4, 5], p=[0.05, 0.25, 0.45, 0.20, 0.05], size=n_house)
    bathrooms = (bedrooms * 0.6 + np.random.choice([0.5, 1.0, 1.5], size=n_house)).round(1)
    year_built = np.random.randint(1960, 2024, size=n_house)
    neighborhood = np.random.choice(["Downtown", "Suburbs", "Uptown", "Waterfront", "Westside"], p=[0.25, 0.30, 0.20, 0.10, 0.15], size=n_house)
    garage_cars = np.random.choice([0, 1, 2, 3], p=[0.1, 0.3, 0.5, 0.1], size=n_house)
    dist_center = np.random.uniform(1.0, 25.0, size=n_house).round(1)

    base_price = (
        sqft * 160
        + bedrooms * 12000
        + bathrooms * 18000
        + (year_built - 1960) * 800
        + (neighborhood == "Waterfront") * 140000
        + (neighborhood == "Downtown") * 80000
        + (neighborhood == "Uptown") * 50000
        + garage_cars * 15000
        - dist_center * 3500
        + np.random.normal(0, 25000, size=n_house)
    )
    price = np.maximum(base_price, 95000).round(-2)

    housing_df = pd.DataFrame({
        "PropertyID": [f"PROP-{2000 + i}" for i in range(n_house)],
        "SquareFootage": sqft,
        "Bedrooms": bedrooms,
        "Bathrooms": bathrooms,
        "YearBuilt": year_built,
        "Neighborhood": neighborhood,
        "GarageCars": garage_cars,
        "DistanceToCityCenter": dist_center,
        "Price": price
    })
    housing_df.loc[np.random.choice(n_house, size=8, replace=False), "SquareFootage"] = np.nan
    housing_df.to_csv(os.path.join(output_dir, "real_estate_housing.csv"), index=False)

    # 3. Customer Segmentation (Clustering)
    n_seg = 500
    age = np.random.randint(18, 70, size=n_seg)
    income = np.random.normal(65000, 25000, size=n_seg).clip(18000, 160000).round(-2)
    spending_score = np.random.randint(1, 100, size=n_seg)
    visit_freq = np.random.randint(1, 30, size=n_seg)
    avg_basket = (income / 1200 + np.random.normal(0, 15, size=n_seg)).clip(15, 250).round(2)
    loyalty_years = np.random.randint(1, 12, size=n_seg)

    seg_df = pd.DataFrame({
        "CustomerID": [f"USER-{3000 + i}" for i in range(n_seg)],
        "Age": age,
        "AnnualIncome": income,
        "SpendingScore": spending_score,
        "VisitFrequency": visit_freq,
        "AverageBasketSize": avg_basket,
        "LoyaltyYears": loyalty_years
    })
    seg_df.to_csv(os.path.join(output_dir, "customer_segmentation.csv"), index=False)

if __name__ == "__main__":
    current_dir = os.path.dirname(os.path.abspath(__file__))
    generate_samples(current_dir)
    print("Successfully generated sample datasets.")
