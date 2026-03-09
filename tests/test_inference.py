from backend.classifier import predict, predict_batch

# Single prediction
result = predict("We may share your data with third parties")
print(result)  # {"classification": "bad", "confidence": 0.85}

# Batch predictions
results = predict_batch(
    [
        "We may share your data with third parties",
        "We delete your data after 30 days",
        "Your data is encrypted in transit",
    ]
)
print(results)
