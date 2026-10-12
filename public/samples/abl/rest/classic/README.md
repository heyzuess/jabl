# Classic REST transport samples

Legacy PASOE / AppServer **REST transport** uses URI mappings → intermediate artifacts (`.pidl`, `resourceModel.xml`) → Ant **PaarGeneration** → deployable `.paar`.

JABL provides:

- Annotated ABL (`CustomerRest.cls`)
- Editable `service-mapping.json` (canonical for the generator)
- `rest-adapter-catalog.paar.md` human sketch
- **Tools → Generate REST catalog…** → `catalog.json`, `resourceModel.xml`, `paar-sketch.md`

Binary `.paar` still requires PDSOE/Ant with `DLC`. Prefer modern WEB (WebHandler / DOH) for new work.
