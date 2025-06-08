import { fontFamily } from "tailwindcss/defaultTheme";

module.exports = {
  theme: {
    fontFamily: {
      sans: ["Inter var", ...fontFamily.sans],
    },
    extend: {
      colors: {
        glass: "rgba(255, 255, 255, 0.3)", // Semi-transparent white
      },
      backdropBlur: {
        sm: "4px",
        DEFAULT: "8px",
        lg: "12px",
      },
      borderRadius: {
        lg: "16px",
      },
      boxShadow: {
        glass: "0 4px 30px rgba(0, 0, 0, 0.1)",
      },
    },
  },
};
