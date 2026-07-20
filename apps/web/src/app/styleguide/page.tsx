import { Metadata } from "next";
import {
  Badge,
  Button,
  Card,
  CodeBlock,
  Container,
  Field,
  Grid,
  PageHeader,
  Skeleton,
  Stack,
  Stat,
  ThemeToggle,
} from "@/components";
import patterns from "@/styles/patterns.module.css";
import styles from "./styleguide.module.css";

export const metadata: Metadata = {
  title: "Styleguide — Noxage Design System",
  description: "Living reference for the Noviq design system tokens and components",
  robots: "noindex",
};

export default function StyleguidePage() {
  return (
    <div className={styles.page}>
      {/* Background */}
      <div className={`${patterns.mesh} ${patterns.filmGrain}`} aria-hidden="true" />

      <Container size="xl" className={styles.container}>
        <div className={styles.header}>
          <PageHeader
            title="Design System"
            description="Noviq playbook reference — 3-tier tokens, OKLCH, dark-first, CSS Modules only"
            actions={<ThemeToggle />}
          />
        </div>

        <Stack direction="vertical" gap="8">
          {/* Colors */}
          <section>
            <h2 className={styles.sectionTitle}>Colors</h2>
            <Stack direction="vertical" gap="6">
              <div>
                <h3 className={styles.subsectionTitle}>Neutral Ramp (OKLCH)</h3>
                <div className={styles.colorGrid}>
                  {[990, 950, 900, 850, 800, 700, 600, 500, 400, 300, 200, 100, 50].map((shade) => (
                    <div key={shade} className={styles.colorSwatch}>
                      <div
                        className={styles.colorBox}
                        style={{ background: `var(--neutral-${shade})` }}
                      />
                      <div className={styles.colorLabel}>{shade}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className={styles.subsectionTitle}>Accent (Violet)</h3>
                <div className={styles.colorGrid}>
                  {[200, 300, 400, 500, 600, 700].map((shade) => (
                    <div key={shade} className={styles.colorSwatch}>
                      <div
                        className={styles.colorBox}
                        style={{ background: `var(--violet-${shade})` }}
                      />
                      <div className={styles.colorLabel}>{shade}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className={styles.subsectionTitle}>Semantic Colors</h3>
                <Grid columns="auto" gap="4">
                  <Card className={styles.semanticCard}>
                    <div className={styles.semanticSwatch} style={{ background: "var(--accent)" }} />
                    <div className={styles.semanticLabel}>Accent</div>
                  </Card>
                  <Card className={styles.semanticCard}>
                    <div className={styles.semanticSwatch} style={{ background: "var(--danger)" }} />
                    <div className={styles.semanticLabel}>Danger</div>
                  </Card>
                  <Card className={styles.semanticCard}>
                    <div className={styles.semanticSwatch} style={{ background: "var(--success)" }} />
                    <div className={styles.semanticLabel}>Success</div>
                  </Card>
                  <Card className={styles.semanticCard}>
                    <div className={styles.semanticSwatch} style={{ background: "var(--warning)" }} />
                    <div className={styles.semanticLabel}>Warning</div>
                  </Card>
                </Grid>
              </div>
            </Stack>
          </section>

          {/* Typography */}
          <section>
            <h2 className={styles.sectionTitle}>Typography</h2>
            <Stack direction="vertical" gap="5">
              <div>
                <h3 className={styles.subsectionTitle}>Font Families</h3>
                <Stack direction="vertical" gap="3">
                  <div className={styles.fontSample} style={{ fontFamily: "var(--font-display)" }}>
                    Space Grotesk — Display (Aa Bb Cc 123)
                  </div>
                  <div className={styles.fontSample} style={{ fontFamily: "var(--font-sans)" }}>
                    Geist — Sans (Aa Bb Cc 123)
                  </div>
                  <div className={styles.fontSample} style={{ fontFamily: "var(--font-mono)" }}>
                    Geist Mono — Mono (Aa Bb Cc 123 0xABC)
                  </div>
                </Stack>
              </div>

              <div>
                <h3 className={styles.subsectionTitle}>Type Scale (Fluid clamp)</h3>
                <Stack direction="vertical" gap="2">
                  <div style={{ fontSize: "var(--fs-step-6)" }}>Step 6 — Display Hero</div>
                  <div style={{ fontSize: "var(--fs-step-5)" }}>Step 5 — Display</div>
                  <div style={{ fontSize: "var(--fs-step-4)" }}>Step 4 — H1</div>
                  <div style={{ fontSize: "var(--fs-step-3)" }}>Step 3 — H2</div>
                  <div style={{ fontSize: "var(--fs-step-2)" }}>Step 2 — H3</div>
                  <div style={{ fontSize: "var(--fs-step-1)" }}>Step 1 — Large</div>
                  <div style={{ fontSize: "var(--fs-step-0)" }}>Step 0 — Body (Base)</div>
                  <div style={{ fontSize: "var(--fs-step--1)" }}>Step -1 — Small / Caption</div>
                </Stack>
              </div>
            </Stack>
          </section>

          {/* Spacing */}
          <section>
            <h2 className={styles.sectionTitle}>Spacing (4px base / 8px rhythm)</h2>
            <Stack direction="vertical" gap="2">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((size) => (
                <div key={size} className={styles.spacingRow}>
                  <div className={styles.spacingLabel}>--space-{size}</div>
                  <div
                    className={styles.spacingBar}
                    style={{ width: `var(--space-${size})` }}
                  />
                </div>
              ))}
            </Stack>
          </section>

          {/* Patterns */}
          <section>
            <h2 className={styles.sectionTitle}>Surface Patterns</h2>
            <Grid columns="2" gap="4">
              <Card>
                <h3 className={styles.patternTitle}>Standard Card</h3>
                <p>Base card with Tier 3 tokens</p>
              </Card>
              <Card glass>
                <h3 className={styles.patternTitle}>Glass Card</h3>
                <p>Translucent with backdrop blur</p>
              </Card>
              <Card glass edgeLight>
                <h3 className={styles.patternTitle}>Glass + Edge Light</h3>
                <p>Gradient 1px border mask</p>
              </Card>
              <div className={`${patterns.mesh} ${styles.patternDemo}`}>
                <div className={styles.patternOverlay}>
                  <h3 className={styles.patternTitle}>Animated Mesh</h3>
                  <p>GPU-cheap gradient drift</p>
                </div>
              </div>
            </Grid>
          </section>

          {/* Buttons */}
          <section>
            <h2 className={styles.sectionTitle}>Buttons</h2>
            <Stack direction="vertical" gap="4">
              <div>
                <h3 className={styles.subsectionTitle}>Variants</h3>
                <Stack direction="horizontal" gap="3" wrap>
                  <Button variant="accent">Accent</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="danger">Danger</Button>
                </Stack>
              </div>
              <div>
                <h3 className={styles.subsectionTitle}>Sizes</h3>
                <Stack direction="horizontal" gap="3" align="center" wrap>
                  <Button size="sm">Small (34px)</Button>
                  <Button size="md">Medium (44px)</Button>
                  <Button size="lg">Large (52px)</Button>
                </Stack>
              </div>
              <div>
                <h3 className={styles.subsectionTitle}>States</h3>
                <Stack direction="horizontal" gap="3" wrap>
                  <Button loading>Loading...</Button>
                  <Button disabled>Disabled</Button>
                </Stack>
              </div>
            </Stack>
          </section>

          {/* Badges */}
          <section>
            <h2 className={styles.sectionTitle}>Badges</h2>
            <Stack direction="horizontal" gap="2" wrap>
              <Badge variant="default">Default</Badge>
              <Badge variant="accent">Accent</Badge>
              <Badge variant="success">Success</Badge>
              <Badge variant="warning">Warning</Badge>
              <Badge variant="danger">Danger</Badge>
              <Badge variant="private">Private</Badge>
              <Badge variant="public">Public</Badge>
            </Stack>
          </section>

          {/* Forms */}
          <section>
            <h2 className={styles.sectionTitle}>Form Fields</h2>
            <Stack direction="vertical" gap="4">
              <Field
                label="Default Field"
                placeholder="Enter text..."
                helper="Helper text appears below"
              />
              <Field
                label="Error State"
                defaultValue="Invalid input"
                error="This field has an error"
              />
              <Field label="Disabled" placeholder="Cannot edit" disabled />
            </Stack>
          </section>

          {/* Stats */}
          <section>
            <h2 className={styles.sectionTitle}>Stats</h2>
            <Grid columns="3" gap="4">
              <Stat label="Total Value" value="$1,234.56" />
              <Stat label="Active Users" value="8,432" change="+12.3%" changeType="positive" />
              <Stat label="Success Rate" value="98.7%" change="-2.1%" changeType="negative" />
            </Grid>
          </section>

          {/* Skeletons */}
          <section>
            <h2 className={styles.sectionTitle}>Skeleton Loaders</h2>
            <Stack direction="vertical" gap="3">
              <Skeleton variant="text" />
              <Skeleton variant="text" width="60%" />
              <Skeleton variant="rectangular" height={100} />
              <Stack direction="horizontal" gap="3">
                <Skeleton variant="circular" width={48} height={48} />
                <Stack direction="vertical" gap="2" style={{ flex: 1 }}>
                  <Skeleton variant="text" />
                  <Skeleton variant="text" width="80%" />
                </Stack>
              </Stack>
            </Stack>
          </section>

          {/* Code Block */}
          <section>
            <h2 className={styles.sectionTitle}>Code Block</h2>
            <Stack direction="vertical" gap="3">
              <CodeBlock code="0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb" />
              <CodeBlock code="npx create-next-app@latest" copyable={false} />
              <CodeBlock
                code="0x1234567890abcdef1234567890abcdef12345678"
                truncate
              />
            </Stack>
          </section>

          {/* Layout Primitives */}
          <section>
            <h2 className={styles.sectionTitle}>Layout Primitives</h2>
            <Stack direction="vertical" gap="4">
              <div>
                <h3 className={styles.subsectionTitle}>Stack (Vertical)</h3>
                <Stack direction="vertical" gap="2">
                  <Card className={styles.demoBox}>Item 1</Card>
                  <Card className={styles.demoBox}>Item 2</Card>
                  <Card className={styles.demoBox}>Item 3</Card>
                </Stack>
              </div>
              <div>
                <h3 className={styles.subsectionTitle}>Stack (Horizontal)</h3>
                <Stack direction="horizontal" gap="2">
                  <Card className={styles.demoBox}>Item 1</Card>
                  <Card className={styles.demoBox}>Item 2</Card>
                  <Card className={styles.demoBox}>Item 3</Card>
                </Stack>
              </div>
              <div>
                <h3 className={styles.subsectionTitle}>Grid (Auto-fit)</h3>
                <Grid columns="auto" gap="3">
                  <Card className={styles.demoBox}>Grid 1</Card>
                  <Card className={styles.demoBox}>Grid 2</Card>
                  <Card className={styles.demoBox}>Grid 3</Card>
                  <Card className={styles.demoBox}>Grid 4</Card>
                </Grid>
              </div>
            </Stack>
          </section>

          {/* PageHeader */}
          <section>
            <h2 className={styles.sectionTitle}>Page Header</h2>
            <Card>
              <PageHeader
                title="Example Page Title"
                description="Optional description text that provides context about the page content"
                actions={
                  <Stack direction="horizontal" gap="2">
                    <Button variant="ghost" size="sm">Cancel</Button>
                    <Button size="sm">Action</Button>
                  </Stack>
                }
              />
            </Card>
          </section>

          {/* Footer */}
          <footer className={styles.footer}>
            <p>
              Noxage Design System · Noviq Playbook · No Tailwind · OKLCH Only · Dark-first
            </p>
            <p className={styles.footerMuted}>
              Built with CSS Modules + CSS Variables · 3-tier tokens · Respects prefers-reduced-motion
            </p>
          </footer>
        </Stack>
      </Container>
    </div>
  );
}
