# Architecture Documentation

This document describes the architectural decisions, patterns, and conventions used in the PersonalBudget Web application.

## 📐 Architecture Overview

The application follows a **layered architecture** pattern with clear separation of concerns:

```
┌─────────────────────────────────────┐
│      Presentation Layer             │
│    (Components, Pages, UI)          │
├─────────────────────────────────────┤
│      Service Layer                  │
│    (API Services, Business Logic)   │
├─────────────────────────────────────┤
│      Data Layer                     │
│    (HTTP Client, API Communication) │
└─────────────────────────────────────┘
```

## 🏗️ Technology Stack

### Core Technologies

- **React 19.1**: Modern UI library with hooks and functional components
- **TypeScript 5.9**: Static typing for better developer experience and fewer runtime errors
- **Vite 7.1**: Fast build tool and development server

### Supporting Libraries

- **Axios 1.12**: HTTP client for API communication with interceptor support
- **ESLint**: Code quality and consistency enforcement
- **Prettier**: Code formatting for consistent style

### Why These Technologies?

1. **React**: 
   - Large ecosystem and community support
   - Component-based architecture for reusability
   - Excellent performance with virtual DOM
   - Perfect for beginners and experienced developers

2. **TypeScript**: 
   - Catches errors at compile-time
   - Better IDE support with autocomplete
   - Self-documenting code with type definitions
   - Easier refactoring and maintenance

3. **Vite**: 
   - Lightning-fast hot module replacement (HMR)
   - Native ES modules support
   - Optimized production builds
   - Simple configuration

4. **Axios**: 
   - Promise-based API
   - Request/response interceptors
   - Automatic JSON transformation
   - Better error handling than fetch

## 📁 Project Structure

### Directory Organization

```
src/
├── components/      # Reusable UI components
├── pages/          # Page-level components (for routing)
├── services/       # API integration layer
├── types/          # TypeScript type definitions
├── utils/          # Helper functions and utilities
├── App.tsx         # Main application component
├── main.tsx        # Application entry point
└── index.css       # Global styles
```

### Component Structure

Each component follows this structure:

```
ComponentName/
├── ComponentName.tsx    # Component logic
└── ComponentName.css    # Component styles
```

Or for simpler components:

```
ComponentName.tsx
ComponentName.css
```

## 🎨 Design Patterns

### 1. Service Layer Pattern

All API communication goes through a dedicated service layer:

```typescript
// services/api.ts
export const transactionService = {
  getAll: async () => { /* ... */ },
  create: async () => { /* ... */ },
  // ...
};
```

**Benefits**:
- Centralized API logic
- Easy to mock for testing
- Consistent error handling
- Simple to add authentication

### 2. Composition Pattern

Components are built using composition rather than inheritance:

```typescript
function Dashboard() {
  return (
    <div>
      <StatCard />
      <TransactionSummary />
    </div>
  );
}
```

**Benefits**:
- More flexible than inheritance
- Better code reuse
- Easier to understand and maintain

### 3. Hooks Pattern

Using React hooks for state and side effects:

```typescript
const [data, setData] = useState([]);
useEffect(() => {
  fetchData();
}, []);
```

**Benefits**:
- Functional components only
- Reusable logic with custom hooks
- Cleaner code than class components

### 4. Interceptor Pattern

HTTP interceptors for cross-cutting concerns:

```typescript
apiClient.interceptors.request.use((config) => {
  // Add auth token
  return config;
});
```

**Benefits**:
- Centralized authentication logic
- Global error handling
- Request/response transformation

## 🔌 API Integration

### Client Configuration

The API client (`src/services/apiClient.ts`) provides:

1. **Base URL Configuration**: Environment-based API URL
2. **Request Interceptors**: Automatic token injection
3. **Response Interceptors**: Global error handling
4. **Timeout Configuration**: 10-second default timeout

### Service Organization

Services are organized by domain:

- `transactionService`: Transaction operations
- `categoryService`: Category management
- `budgetService`: Budget tracking
- `dashboardService`: Statistics and reports

### Error Handling Strategy

```typescript
try {
  const data = await transactionService.getAll();
  setData(data);
} catch (error) {
  setError('Failed to load data');
  console.error(error);
}
```

**Principles**:
- Always handle errors in components
- Show user-friendly error messages
- Log technical details to console
- Never expose sensitive error information

## 🎯 State Management

Currently using **React's built-in state management**:

- `useState` for component-local state
- `useEffect` for side effects and data fetching

### Why Not Redux/MobX/Zustand?

For this application:
- State is mostly component-local
- No complex state sharing between distant components
- Simpler learning curve for beginners

**Future Consideration**: If the app grows and state management becomes complex, consider:
- React Context API for global state
- Zustand for lightweight global state
- TanStack Query (React Query) for server state

## 🎨 Styling Strategy

### Current Approach: CSS Modules Pattern

Each component has its own CSS file:

```
Dashboard.tsx
Dashboard.css
```

**Benefits**:
- No CSS-in-JS runtime overhead
- Familiar CSS syntax
- Easy for beginners
- No additional dependencies

### Naming Conventions

- Use kebab-case for CSS classes: `.stat-card`, `.nav-links`
- Use descriptive names: `.transaction-list`, not `.list`
- Scope styles to component: `.dashboard .stat-card`

### Responsive Design

Using CSS media queries:

```css
@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
```

## 🔒 Security Considerations

### Current Implementation

1. **Token Storage**: localStorage (simple but not ideal for production)
2. **Request Timeout**: 10 seconds to prevent hanging
3. **CORS**: Backend must configure allowed origins
4. **Environment Variables**: Sensitive config in `.env.local`

### Production Recommendations

1. **Authentication**: Use httpOnly cookies instead of localStorage
2. **HTTPS**: Always use HTTPS in production
3. **Content Security Policy**: Add CSP headers
4. **Input Validation**: Validate all user inputs
5. **Dependency Updates**: Regularly update dependencies

## 🧪 Testing Strategy (Future)

Recommended testing approach:

1. **Unit Tests**: Jest + React Testing Library
2. **Integration Tests**: Test API integration with MSW (Mock Service Worker)
3. **E2E Tests**: Playwright or Cypress for critical user flows

## 📈 Scalability Considerations

### Current Design Supports

1. **Code Splitting**: Vite supports dynamic imports
2. **Lazy Loading**: React.lazy for route-based code splitting
3. **Caching**: Axios response caching can be added
4. **Performance**: Virtual lists for large datasets

### Future Enhancements

1. **Routing**: Add React Router for multi-page navigation
2. **Form Management**: Add Formik or React Hook Form
3. **Data Caching**: Implement TanStack Query
4. **Offline Support**: Add service workers and PWA features
5. **Internationalization**: Add i18next for multi-language support

## 🔄 Development Workflow

### Code Quality Tools

1. **ESLint**: Checks code for potential errors and style issues
2. **Prettier**: Formats code consistently
3. **TypeScript**: Type checking before build

### Build Process

```bash
# Development
npm run dev          # Vite dev server with HMR

# Production
npm run build        # TypeScript check + Vite build
npm run preview      # Preview production build
```

### Git Workflow

1. Feature branches: `feature/feature-name`
2. Bug fixes: `fix/bug-description`
3. Clear commit messages
4. Pull requests for review

## 📚 Learning Path for Contributors

### Beginner Level

1. Understand React basics (components, props, state)
2. Learn TypeScript fundamentals
3. Explore the components folder
4. Make small UI changes

### Intermediate Level

1. Understand React hooks (useState, useEffect)
2. Learn about API integration
3. Create new components
4. Add new features

### Advanced Level

1. Design new architectural patterns
2. Optimize performance
3. Implement complex features
4. Set up testing infrastructure

## 🎓 Best Practices

### Component Design

✅ **Do**:
- Keep components small and focused
- Use descriptive names
- Extract reusable logic
- Handle loading and error states

❌ **Don't**:
- Mix business logic with presentation
- Create huge components
- Forget error handling
- Ignore TypeScript warnings

### API Integration

✅ **Do**:
- Use the service layer
- Handle all error cases
- Show loading states
- Add request timeouts

❌ **Don't**:
- Call axios directly in components
- Ignore errors silently
- Block UI without loading indicators
- Hard-code API URLs

### State Management

✅ **Do**:
- Keep state as local as possible
- Lift state up when needed
- Use proper TypeScript types
- Initialize state properly

❌ **Don't**:
- Over-use global state
- Mutate state directly
- Forget to clean up effects
- Use `any` type

## 🔄 Migration Paths

### Adding Routing

```typescript
// Install React Router
npm install react-router-dom

// Update App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/transactions" element={<TransactionList />} />
      </Routes>
    </BrowserRouter>
  );
}
```

### Adding Global State

```typescript
// Install Zustand
npm install zustand

// Create store
import create from 'zustand';

const useStore = create((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}));
```

## 📞 Questions and Support

For architectural questions:

1. Check this documentation first
2. Review existing code for patterns
3. Open a GitHub issue for discussion
4. Ask in pull request comments

---

**Remember**: Architecture should serve the team and the project goals. Keep it simple, but be ready to evolve as needs grow.
