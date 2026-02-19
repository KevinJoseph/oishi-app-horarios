import React from 'react';
import ReactDOM from 'react-dom/client';
import { ChakraProvider, extendTheme } from '@chakra-ui/react';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

const theme = extendTheme({
  colors: {
    brand: {
      50: '#eef6ff',
      100: '#d5e7ff',
      200: '#b2d3ff',
      300: '#82b7ff',
      400: '#4d93ff',
      500: '#2f75f6',
      600: '#215bd4',
      700: '#1e4bb0',
      800: '#1f418f',
      900: '#213977'
    }
  },
  styles: {
    global: {
      body: {
        bg: 'linear-gradient(180deg, #f8fbff 0%, #f3f6fb 50%, #f6f8fc 100%)',
        color: 'gray.800'
      }
    }
  },
  fonts: {
    heading: `'DM Sans', sans-serif`,
    body: `'DM Sans', sans-serif`
  },
  shadows: {
    outline: '0 0 0 3px rgba(47, 117, 246, 0.24)'
  },
  radii: {
    xl: '14px'
  },
  components: {
    Card: {
      baseStyle: {
        container: {
          borderRadius: 'xl',
          borderWidth: '1px',
          borderColor: 'blackAlpha.100',
          bg: 'white',
          boxShadow: '0 10px 30px rgba(15, 23, 42, 0.06)'
        }
      }
    },
    Button: {
      defaultProps: {
        colorScheme: 'brand'
      },
      variants: {
        solid: {
          fontWeight: '700',
          borderRadius: 'md'
        },
        outline: {
          borderRadius: 'md'
        },
        ghost: {
          borderRadius: 'md'
        }
      }
    },
    Input: {
      defaultProps: {
        focusBorderColor: 'brand.500'
      }
    },
    Select: {
      defaultProps: {
        focusBorderColor: 'brand.500'
      }
    },
    Table: {
      baseStyle: {
        th: {
          color: 'gray.600',
          fontSize: '12px',
          letterSpacing: '0.04em',
          textTransform: 'uppercase'
        },
        td: {
          color: 'gray.800'
        }
      }
    },
    Badge: {
      baseStyle: {
        borderRadius: 'md',
        fontWeight: '700'
      }
    },
    Modal: {
      baseStyle: {
        dialog: {
          borderRadius: 'xl',
          borderWidth: '1px',
          borderColor: 'blackAlpha.100'
        }
      }
    }
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ChakraProvider theme={theme}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ChakraProvider>
  </React.StrictMode>
);
