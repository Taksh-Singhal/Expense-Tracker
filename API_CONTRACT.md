# API CONTRACT & DOCUMENTATION

**Base URL:** - Mock Server: `http://localhost:3000/api`
- Real Backend: `http://localhost:8000/api`

## 1. Authentication
| Method | Endpoint | Input JSON | Output JSON |
| :--- | :--- | :--- | :--- |
| **POST** | `/auth/register` | `{ "name": "John", "email": "john@college.edu", "password": "pass" }` | `{ "message": "User created", "user_id": 1 }` |
| **POST** | `/auth/login` | `{ "email": "john@college.edu", "password": "pass" }` | `{ "token": "abc123xyz", "user": { "name": "John" } }` |
| **GET** | `/auth/me` | *(Header: Authorization Token)* | `{ "id": 1, "name": "John", "email": "john@college.edu" }` |

## 2. Expenses (Transactions)
| Method | Endpoint | Input JSON | Output JSON |
| :--- | :--- | :--- | :--- |
| **GET** | `/expenses` | *(Empty)* | `[ { "id": 1, "title": "Coffee", "amount": 50, "category": "Food", "date": "2023-10-01" }, ... ]` |
| **POST** | `/expenses` | `{ "title": "Books", "amount": 500, "category": "Education", "date": "2023-10-05" }` | `{ "message": "Expense Added", "id": 102 }` |
| **PUT** | `/expenses/:id` | `{ "amount": 550 }` | `{ "message": "Updated Successfully" }` |
| **DELETE** | `/expenses/:id` | *(Empty)* | `{ "message": "Deleted Successfully" }` |

## 3. Budgets
| Method | Endpoint | Input JSON | Output JSON |
| :--- | :--- | :--- | :--- |
| **POST** | `/budgets` | `{ "category": "Food", "limit": 2000 }` | `{ "message": "Budget Set", "id": 5 }` |
| **GET** | `/budgets/status`| *(Empty)* | `[ { "category": "Food", "limit": 2000, "spent": 1500, "remaining": 500 } ]` |

## 4. AIML Features (The Brain)
| Method | Endpoint | Input JSON | Output JSON |
| :--- | :--- | :--- | :--- |
| **POST** | `/aiml/predict` | `{ "text": "Starbucks Coffee 10/05" }` | `{ "predicted_category": "Food", "confidence": 0.95 }` |
| **GET** | `/aiml/forecast` | *(Empty)* | `{ "next_month_prediction": 5000, "trend": "increasing" }` |
| **GET** | `/aiml/compare` | *(Empty)* | `{ "your_total": 5000, "peer_average": 4200, "message": "You spent 19% more than average." }` |
| **POST** | `/aiml/chat` | `{ "question": "How much did I spend?" }` | `{ "answer": "You spent $50 on food." }` |