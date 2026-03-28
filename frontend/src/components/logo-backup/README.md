# Solvent AI Logo Backup

**Created:** March 13, 2026

This directory contains the original logo implementation before the comprehensive redesign.

## Files

- `TitleBar-Logo.tsx` - The simplified logo used in the TitleBar component (32px)
- `HomeArea-Logo.tsx` - The full featured hero logo from HomeArea component (200-1000px)
- `original-usage-notes.md` - Documentation of how the logo was used across the app

## Original Features

### TitleBar Logo (Small)
- 32x32px icon
- Simplified fluid animation (4s cycle)
- Basic bubble effects
- No text integration
- Hover: 12° rotation + glow intensification
- Click: Navigates to home mode

### HomeArea Logo (Hero)
- 200px mobile, up to 1000px desktop
- Full fluid dynamics with color cycling gradients
- Neural network background pattern
- Multiple bubble layers (5 bubbles)
- Sparkle particle effects
- "SOLVENT BY KAUSTIKSOLUTIONS" text integration
- Ambient glow layers (3 colors)
- 6s fluid animation cycle
- Drop shadow: `0 0 60px rgba(157,91,210,0.6)`

## Color Palette (Original)

```
Electric Volt:  #3C71F7 (Primary/Logic)
Neural Purple:  #9D5BD2 (Agentic)
Neon Amber:     #FB923C (Action)
Cyber Cyan:     #06B6D4 (Accent)
Void Black:     #020205 (Background)
```

## Next Steps

After backup, the logo will be:
1. Extracted to a dedicated `Logo.tsx` component
2. Enhanced with improved animations
3. Made reusable with props for size/variant
4. Favicon will be created
5. Typography lockup system added

---

**Note:** Both versions use Framer Motion for path animations and SMIL for gradient color cycling.
