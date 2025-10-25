# PersonalBudget Web

Front-end application for PersonalBudget - A personal finance management system built with React, Vite, and TypeScript.

![React](https://img.shields.io/badge/React-19.1-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)
![Vite](https://img.shields.io/badge/Vite-7.1-brightgreen)

## 🚀 Features

- **Dashboard**: View financial statistics and summaries at a glance
- **Transaction Management**: List, filter, and paginate through income and expense transactions
- **Category Organization**: Organize transactions by categories
- **Budget Tracking**: Monitor budget allocations and spending
- **Responsive Design**: Mobile-friendly interface that works on all devices
- **Type-Safe**: Full TypeScript support for better development experience
- **API Integration**: Ready-to-use HTTP client for PersonalBudget API

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- [Node.js](https://nodejs.org/) (version 18 or higher)
- [npm](https://www.npmjs.com/) (comes with Node.js)
- PersonalBudget API backend running (default: `http://localhost:8080`)

## 🛠️ Installation

1. **Clone the repository**

```bash
git clone https://github.com/brunosilvaJava/personalbudget-web.git
cd personalbudget-web
```

2. **Install dependencies**

```bash
npm install
```

3. **Configure environment variables**

Create a `.env.local` file in the root directory:

```bash
cp .env.example .env.local
```

Edit `.env.local` and update the API URL if needed:

```env
VITE_API_BASE_URL=http://localhost:8080/api
```

## 🚀 Running the Application

### Development Mode

Start the development server with hot-reload:

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### Production Build

Build the application for production:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## 📝 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint to check code quality
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check if code is formatted correctly

## 🏗️ Project Structure

```
personalbudget-web/
├── src/
│   ├── components/        # React components
│   │   ├── Dashboard.tsx
│   │   ├── Dashboard.css
│   │   ├── TransactionList.tsx
│   │   └── TransactionList.css
│   ├── services/          # API service layer
│   │   ├── apiClient.ts   # Axios HTTP client configuration
│   │   └── api.ts         # API endpoint functions
│   ├── types/             # TypeScript type definitions
│   │   └── api.ts
│   ├── pages/             # Page components (for routing)
│   ├── utils/             # Utility functions
│   ├── App.tsx            # Main application component
│   ├── App.css
│   ├── main.tsx           # Application entry point
│   └── index.css          # Global styles
├── public/                # Static assets
├── .env.example           # Environment variables template
├── .prettierrc            # Prettier configuration
├── eslint.config.js       # ESLint configuration
├── tsconfig.json          # TypeScript configuration
├── vite.config.ts         # Vite configuration
└── package.json           # Dependencies and scripts
```

## 🔌 API Integration

The application integrates with the PersonalBudget API through a service layer:

### API Client Configuration

The HTTP client is configured in `src/services/apiClient.ts` with:

- Base URL configuration
- Request/response interceptors
- Authentication token handling
- Global error handling
- 10-second timeout

### Available Services

- **transactionService**: CRUD operations for transactions
- **categoryService**: Manage income/expense categories
- **budgetService**: Budget allocation management
- **dashboardService**: Dashboard statistics and reports

### Example Usage

```typescript
import { transactionService } from './services/api';

// Fetch all transactions
const transactions = await transactionService.getAll(1, 10);

// Create a new transaction
const newTransaction = await transactionService.create({
  description: 'Salary',
  amount: 5000,
  type: 'INCOME',
  category: 'Work',
  date: '2025-01-15',
});
```

## 🎨 Code Style

This project uses:

- **ESLint** for code linting
- **Prettier** for code formatting
- **TypeScript** for type safety

Run linting and formatting:

```bash
npm run lint
npm run format
```

## 🤝 Contributing

We welcome contributions from developers of all skill levels! Here's how you can contribute:

### For Beginners

1. **Fork the repository** - Click the "Fork" button at the top right
2. **Clone your fork** - `git clone https://github.com/YOUR-USERNAME/personalbudget-web.git`
3. **Create a branch** - `git checkout -b feature/your-feature-name`
4. **Make your changes** - Edit files and test locally
5. **Commit your changes** - `git commit -m "Add: your feature description"`
6. **Push to your fork** - `git push origin feature/your-feature-name`
7. **Create a Pull Request** - Go to the original repo and click "New Pull Request"

### Contribution Guidelines

- Write clear, descriptive commit messages
- Follow the existing code style (use `npm run format`)
- Ensure your code passes linting (`npm run lint`)
- Test your changes thoroughly before submitting
- Update documentation if needed
- Keep pull requests focused on a single feature/fix

### Development Tips

- Use the React DevTools browser extension for debugging
- Check the browser console for errors during development
- The app uses hot-reload, so changes appear instantly
- TypeScript will help you catch errors before runtime

## 📚 Learning Resources

New to React, Vite, or TypeScript? Here are some helpful resources:

- [React Documentation](https://react.dev/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Vite Documentation](https://vite.dev/)
- [Axios Documentation](https://axios-http.com/docs/intro)
- [MDN Web Docs](https://developer.mozilla.org/)

## 📄 Architecture

For detailed information about architectural decisions and patterns used in this project, see [ARCHITECTURE.md](./ARCHITECTURE.md).

## 🔒 Security

- Never commit `.env.local` or any files containing sensitive data
- API tokens are stored in localStorage (consider using httpOnly cookies for production)
- CORS must be properly configured on the backend API
- All API requests have a 10-second timeout to prevent hanging requests

## 📞 Support

If you encounter any issues or have questions:

1. Check the [Issues](https://github.com/brunosilvaJava/personalbudget-web/issues) page
2. Create a new issue with a detailed description
3. Provide error messages, screenshots, and steps to reproduce

## 📝 License

This project is open source and available for educational and personal use.

## 🙏 Acknowledgments

- Built with [React](https://react.dev/)
- Powered by [Vite](https://vite.dev/)
- Type-safe with [TypeScript](https://www.typescriptlang.org/)
- HTTP client by [Axios](https://axios-http.com/)

---

**Happy coding! 💻✨**
