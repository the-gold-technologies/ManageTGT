/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './app/**/*.{js,ts,jsx,tsx,mdx}',
        './components/**/*.{js,ts,jsx,tsx,mdx}',
        './lib/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
            },
            colors: {
                bg: 'var(--color-bg)',
                'bg-secondary': 'var(--color-bg-secondary)',
                'bg-tertiary': 'var(--color-bg-tertiary)',
                border: 'var(--color-border)',
                'border-muted': 'var(--color-border-muted)',
                primary: 'var(--color-primary)',
                'primary-hover': 'var(--color-primary-hover)',
                'primary-foreground': 'var(--color-primary-foreground)',
                'accent-cyan': 'var(--color-accent-cyan)',
                'accent-purple': 'var(--color-accent-purple)',
                'accent-pink': 'var(--color-accent-pink)',
                success: 'var(--color-success)',
                'success-muted': 'var(--color-success-muted)',
                'success-foreground': 'var(--color-success-foreground)',
                warning: 'var(--color-warning)',
                'warning-muted': 'var(--color-warning-muted)',
                'warning-foreground': 'var(--color-warning-foreground)',
                danger: 'var(--color-danger)',
                'danger-muted': 'var(--color-danger-muted)',
                'danger-foreground': 'var(--color-danger-foreground)',
                info: 'var(--color-info)',
                'info-muted': 'var(--color-info-muted)',
                text: 'var(--color-text)',
                'text-secondary': 'var(--color-text-secondary)',
                'text-muted': 'var(--color-text-muted)',
            },
            boxShadow: {
                card: 'var(--shadow-card)',
                glow: 'var(--shadow-glow)',
                'glow-sm': 'var(--shadow-glow-sm)',
            },
            borderRadius: {
                '4xl': 'var(--radius-4xl)',
            },
            animation: {
                'fade-in': 'var(--animate-fade-in)',
                'slide-up': 'var(--animate-slide-up)',
                'pulse-slow': 'var(--animate-pulse-slow)',
            },
        },
    },
    plugins: [
        require('@tailwindcss/typography'),
    ],
}
