# Solvent AI Logo Component - Usage Guide

## Overview

The new `Logo` component is a comprehensive, reusable logo system with multiple variants, enhanced animations, and full accessibility support.

**Location:** `src/components/Logo.tsx`

---

## Quick Start

```tsx
import { Logo } from './Logo';

// Basic usage
<Logo />

// With custom size
<Logo size="lg" />

// With variant
<Logo variant="combined" />
```

---

## Props API

### `size`
Controls the logo dimensions.

**Type:** `'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'hero' | number`

**Default:** `'md'`

**Preset Values:**
- `xs`: 16px - Tiny icons, tooltips
- `sm`: 32px - TitleBar, navigation
- `md`: 64px - Standard displays
- `lg`: 128px - Feature sections
- `xl`: 200px - Hero displays
- `hero`: 400px - Large background elements
- `number`: Custom pixel size

**Example:**
```tsx
<Logo size="sm" />
<Logo size={150} />
```

---

### `variant`
Determines the logo composition.

**Type:** `'beaker' | 'text' | 'combined' | 'icon' | 'minimal'`

**Default:** `'beaker'`

**Variants:**
- `beaker`: Animated beaker icon only
- `text`: "Solvent AI" text only
- `combined`: Beaker + text side-by-side
- `icon`: Alias for beaker
- `minimal`: Simplified beaker (no sparkles/neural network)

**Example:**
```tsx
<Logo variant="beaker" />
<Logo variant="text" size="lg" />
<Logo variant="combined" size="lg" />
```

---

### `state`
Controls animation state for interactive feedback.

**Type:** `'idle' | 'hover' | 'active' | 'loading'`

**Default:** `'idle'`

**States:**
- `idle`: Normal fluid animation
- `hover`: Intensified fluid movement
- `active`: Surge animation (on click)
- `loading`: Future loading animation

**Example:**
```tsx
const [state, setState] = useState<'idle' | 'hover'>('idle');

<Logo 
  state={state}
  onMouseEnter={() => setState('hover')}
  onMouseLeave={() => setState('idle')}
/>
```

---

### `animated`
Enable/disable all animations.

**Type:** `boolean`

**Default:** `true`

**Example:**
```tsx
<Logo animated={false} />
```

---

### `opacity`
Control transparency level.

**Type:** `number` (0-1)

**Default:** `1`

**Example:**
```tsx
<Logo opacity={0.5} />
```

---

### `simplified`
Use reduced detail for performance.

**Type:** `boolean`

**Default:** `false`

**Effects:**
- Fewer bubbles (2 vs 5)
- No sparkle particles
- No neural network pattern
- Shorter animation duration
- Thinner stroke widths

**Example:**
```tsx
<Logo simplified={true} />
```

---

### `colorScheme`
Apply different color palettes.

**Type:** `'default' | 'monochrome' | 'accent' | 'purple' | 'cyan'`

**Default:** `'default'`

**Schemes:**
- `default`: Electric Volt (#3C71F7) → Neural Purple (#9D5BD2) → Neon Amber (#FB923C)
- `monochrome`: White → Light Gray
- `accent`: Neon Amber → Rose → Electric Volt
- `purple`: Neural Purple → Deep Purple → Light Purple
- `cyan`: Cyber Cyan → Deep Cyan → Light Cyan

**Example:**
```tsx
<Logo colorScheme="purple" />
<Logo colorScheme="accent" />
```

---

### `className`
Additional CSS classes.

**Type:** `string`

**Example:**
```tsx
<Logo className="custom-class hover:scale-110" />
```

---

### `onClick`
Click handler (makes logo interactive).

**Type:** `() => void`

**Example:**
```tsx
<Logo onClick={() => navigate('/home')} />
```

---

### `ariaLabel`
Accessibility label for screen readers.

**Type:** `string`

**Default:** `'Solvent AI Logo'`

**Example:**
```tsx
<Logo ariaLabel="Solvent AI - Return to Home" />
```

---

## Usage Examples

### 1. TitleBar Logo (Current Implementation)

```tsx
import { Logo } from './Logo';

<div className="w-8 h-8" onClick={() => setCurrentMode('home')}>
  <Logo 
    size="sm" 
    variant="beaker" 
    animated={true}
    ariaLabel="Solvent AI Home"
  />
</div>
```

### 2. Hero Section Logo

```tsx
import { Logo } from './Logo';

<div className="w-[200px] h-[200px]">
  <Logo 
    size="xl" 
    variant="hero" 
    animated={true}
    opacity={0.28}
  />
</div>
```

### 3. Combined Logo with Text

```tsx
<Logo 
  variant="combined" 
  size="lg"
  colorScheme="default"
  onClick={() => navigate('/')}
/>
```

### 4. Loading State (Future)

```tsx
const [isLoading, setIsLoading] = useState(true);

<Logo 
  state={isLoading ? 'loading' : 'idle'}
  variant="beaker"
  size="lg"
/>
```

### 5. Monochrome Variant

```tsx
<Logo 
  colorScheme="monochrome"
  size="md"
  opacity={0.8}
/>
```

### 6. Background Watermark

```tsx
<div className="absolute inset-0 opacity-[0.03] pointer-events-none">
  <Logo size="hero" simplified={true} animated={false} />
</div>
```

### 7. Mobile Optimized

```tsx
<Logo 
  size="md"
  simplified={true}
  animated={!devicePrefersReducedMotion}
/>
```

---

## Performance Considerations

### Simplified Mode
Use `simplified={true}` for:
- Mobile devices
- Background elements
- Multiple logo instances
- Low-power modes

```tsx
<Logo simplified={true} size="lg" />
```

### Disable Animations
Respect user preferences:

```tsx
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

<Logo animated={!prefersReducedMotion} />
```

### Size Optimization
- Use appropriate size presets (don't render 400px logo at 32px)
- Consider SVG optimization for production
- Lazy load hero logos

---

## Accessibility

### Built-in Features
- `role="img"` on SVG
- Configurable `aria-label`
- Respects `prefers-reduced-motion`
- Keyboard accessible when interactive

### Best Practices

```tsx
// Always provide meaningful aria labels
<Logo ariaLabel="Solvent AI - Navigate to Home" onClick={goHome} />

// Respect motion preferences
const prefersReducedMotion = usePrefersReducedMotion();
<Logo animated={!prefersReducedMotion} />

// Ensure sufficient contrast
<Logo opacity={1} colorScheme="default" />
```

---

## Color System

### Default Palette
```
Electric Volt:  #3C71F7 (Primary/Logic)
Neural Purple:  #9D5BD2 (Agentic)
Neon Amber:     #FB923C (Action)
Cyber Cyan:     #06B6D4 (Accent)
Void Black:     #020205 (Background)
```

### Gradient Flow
The fluid gradient cycles:
1. **Top:** Neon Amber (#FB923C)
2. **Upper Middle:** Rose (#F43F5E)
3. **Lower Middle:** Neural Purple (#9D5BD2)
4. **Bottom:** Electric Volt (#3C71F7)

---

## Animation System

### Fluid Dynamics
- **Duration:** 3-8s (based on size)
- **Easing:** easeInOut
- **Layers:** Primary + Secondary (offset timing)

### Bubble System
- **Count:** 2-5 (based on simplified flag)
- **Behavior:** Rise and fade
- **Stagger:** 0.7s delay between each

### Sparkle Particles
- **Count:** 4 (disabled in simplified mode)
- **Effect:** Pulse + scale
- **Colors:** White + accent color

---

## Migration from Old Logo

### Before (TitleBar)
```tsx
<svg viewBox="0 0 100 100" className="w-8 h-8">
  {/* 100+ lines of SVG code */}
</svg>
```

### After (TitleBar)
```tsx
<Logo size="sm" variant="beaker" ariaLabel="Solvent AI" />
```

### Before (HomeArea)
```tsx
<svg viewBox="0 0 100 100" className="w-full h-full">
  {/* 250+ lines of SVG code */}
</svg>
```

### After (HomeArea)
```tsx
<Logo size="xl" variant="hero" />
```

---

## Future Enhancements

### Planned Features
1. **3D Variant:** Three.js beaker with real fluid simulation
2. **Theme Variants:** Light mode support
3. **Loading Animation:** Progress indicator integration
4. **Sound Effects:** Subtle audio feedback
5. **Lottie Export:** For marketing materials
6. **AR/VR Ready:** 3D model for spatial computing

### Experimental
```tsx
// Future 3D variant (not yet implemented)
<Logo variant="3d" size="lg" />

// Future light mode variant
<Logo theme="light" />
```

---

## Troubleshooting

### Logo not animating
- Check `animated` prop is `true`
- Verify `prefers-reduced-motion` isn't enabled
- Ensure Framer Motion is installed

### Colors look wrong
- Verify `colorScheme` prop
- Check Tailwind config for color definitions
- Ensure gradients are properly defined

### Performance issues
- Enable `simplified={true}`
- Reduce logo size
- Disable animations on background elements
- Check for multiple large logo instances

---

## Support

For issues or questions, refer to:
- Component source: `src/components/Logo.tsx`
- Backup of original: `src/components/logo-backup/`
- Tailwind config: `tailwind.config.js`

---

**Last Updated:** March 13, 2026
**Version:** 1.0.0
