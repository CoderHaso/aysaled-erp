ALTER TABLE product_recipes ADD COLUMN IF NOT EXISTS other_costs jsonb DEFAULT '[]';

INSERT INTO app_settings (id, value)
VALUES (
  'recipe_costs', 
  '["İşçilik", "Boya", "Genel gider", "Kaynak", "Ekstra"]'::jsonb
)
ON CONFLICT (id) DO NOTHING;
