import React, { createContext, useContext, useReducer } from 'react';

const AuthContext = createContext();

const initialState = {
  inputValue: '',
  passwordValue: '',
};

const authReducer = (state, action) => {
  switch (action.type) {
    case 'SET_INPUT_VALUE':
      return { ...state, inputValue: action.payload };
    case 'SET_PASSWORD_VALUE':
      return { ...state, passwordValue: action.payload };
    case 'CLEAR_TC':
      return { ...state, inputValue: '' };
    case 'CLEAR_PASSWORD':
      return { ...state, passwordValue: '' };
    case 'RESET_AUTH':
      return { ...initialState }; // State'i sıfırla
    default:
      return state;
  }
};

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  return (
    <AuthContext.Provider value={{ state, dispatch }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);