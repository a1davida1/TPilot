# 🔥 Redis Color Scheme Implementation

Stolen from https://redis.io with love.

## Color Palette

```css
--redis-red: #DC382C
--redis-orange: #FF6B35
--redis-dark: #0A0E27
--redis-navy: #1A1F3A
--redis-slate: #252B47
```

## Usage Examples

### Background Colors
```tsx
<div className="bg-redis-dark">Dark background</div>
<div className="bg-redis-navy">Navy background</div>
<div className="bg-redis-slate">Slate background</div>
```

### Text Colors
```tsx
<span className="text-redis-red">Red text</span>
<span className="text-redis-orange">Orange text</span>
```

### Border Colors
```tsx
<div className="border border-redis-orange">Orange border</div>
<div className="border border-redis-slate">Slate border</div>
```

### Gradient Background
```tsx
<div className="bg-redis-gradient">
  Fire gradient background (red → orange)
</div>
```

### Gradient Text
```tsx
<h1 className="text-redis-gradient text-4xl font-bold">
  Gradient text
</h1>
```

## Component Examples

### Hero Section
```tsx
<Card className="bg-redis-dark border-redis-slate">
  <CardHeader>
    <h1 className="text-redis-gradient text-4xl">
      Your Headline
    </h1>
  </CardHeader>
</Card>
```

### CTA Button
```tsx
<Button className="bg-redis-gradient hover:opacity-90 text-white">
  Get Started
</Button>
```

### Accent Badge
```tsx
<Badge className="bg-redis-red/20 text-redis-orange border-redis-orange/30">
  Hot Feature
</Badge>
```

### Feature Card
```tsx
<Card className="bg-redis-navy border-redis-slate hover:border-redis-orange">
  <CardContent>
    <div className="w-12 h-12 bg-redis-gradient rounded-lg">
      <Icon className="text-white" />
    </div>
    <h3 className="text-white">Feature Title</h3>
    <p className="text-gray-400">Description</p>
  </CardContent>
</Card>
```

## Demo Component

Check out `/client/src/components/redis-demo-card.tsx` for a complete implementation example!

## Where to Use

**Great for:**
- Landing pages
- Pro features sections
- Performance/speed-related content
- Call-to-action buttons
- Premium tier badges
- Dashboard stats

**Pairs well with:**
- Dark mode themes
- Tech/developer focused content
- Performance metrics
- Real-time features
