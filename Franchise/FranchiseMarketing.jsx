import React, { useEffect, useState } from "react";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import {
  Image,
  Video,
  FileText,
  Download,
  Eye,
  BookOpen,
  Share2,
  Copy,
  ExternalLink,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { toast } from "sonner";

export default function FranchiseMarketing() {
  const [materials, setMaterials] = useState([]);
  const [selectedMaterial, setSelectedMaterial] = useState(null);

  const db = getFirestore();

  useEffect(() => {
    const loadMaterials = async () => {
      try {
        const q = query(
          collection(db, "marketingMaterials"),
          where("forFranchise", "==", true)
        );
        const snap = await getDocs(q);
        setMaterials(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error(e);
      }
    };

    loadMaterials();
  }, []);

  const typeIcons = {
    image: Image,
    video: Video,
    document: FileText,
    text: FileText,
  };

  const copyText = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Texto copiado!");
  };

  // Fallback se Firestore estiver vazio
  const sampleMaterials = [
    {
      id: "1",
      title: "Post Instagram - Economia",
      type: "image",
      category: "social_media",
      description: "Post para Instagram sobre economia com energia solar",
      file_url:
        "https://images.unsplash.com/photo-1509391366360-2e959784a276?w=600",
    },
    {
      id: "2",
      title: "Post Facebook - Cadastro",
      type: "image",
      category: "social_media",
      description: "Arte para captação de novas famílias",
      file_url:
        "https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?w=600",
    },
    {
      id: "3",
      title: "Flyer A5 - Divulgação Local",
      type: "image",
      category: "flyer",
      description: "Flyer para impressão e distribuição na região",
      file_url:
        "https://images.unsplash.com/photo-1497440001374-f26997328c1b?w=600",
    },
    {
      id: "4",
      title: "Apresentação Comercial",
      type: "document",
      category: "presentation",
      description: "Slides para apresentar o projeto para grupos",
      file_url: "#",
    },
    {
      id: "5",
      title: "Manual do Franqueado",
      type: "document",
      category: "manual",
      description: "Guia completo de operação da franquia",
      file_url: "#",
    },
  ];

  const displayMaterials =
    materials.length > 0 ? materials : sampleMaterials;

  const textTemplates = [
    {
      title: "WhatsApp - Captação",
      content: `🌞 *Sol da Gente - Energia Solar Acessível*

Olá! Você sabia que pode trocar sua conta de luz por um kit solar completo?

✅ Sem entrada
✅ Parcelas menores que sua conta de luz atual
✅ Kit instalado gratuitamente
✅ Economia de até 95%

Quer saber mais? Me chama que eu explico tudo! 👇`,
    },
    {
      title: "WhatsApp - Convite para grupo",
      content: `🌞 *Convite Especial - Sol da Gente*

Oi! Estamos formando um novo grupo de famílias para instalação de energia solar na nossa região.

📍 Local: [CIDADE]
👥 Vagas: [XX] famílias
💰 Parcelas a partir de R$ 150/mês

Quer fazer parte? Me chama para garantir sua vaga! ☀️`,
    },
    {
      title: "Instagram - Legenda",
      content: `☀️ Imagine pagar menos de R$ 50/mês de energia depois de quitar seu kit solar!

Com o Sol da Gente, você:
✨ Não precisa de entrada
✨ Paga parcelas acessíveis
✨ Ganha independência da concessionária
✨ Economiza por mais de 25 anos

Quer saber como? Link na bio! 👆

#EnergiaSolar #Economia #SolDaGente #SustentabilidadeAcessível`,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Marketing</h1>
        <p className="text-slate-600">
          Materiais de divulgação e conteúdo para redes sociais
        </p>
      </div>

      <Tabs defaultValue="social">
        <TabsList className="mb-4">
          <TabsTrigger value="social">Redes Sociais</TabsTrigger>
          <TabsTrigger value="flyers">Impressos</TabsTrigger>
          <TabsTrigger value="texts">Textos Prontos</TabsTrigger>
          <TabsTrigger value="manual">Manual</TabsTrigger>
        </TabsList>

        {/* REDES SOCIAIS */}
        <TabsContent value="social">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-pink-500" />
                Artes para Redes Sociais
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayMaterials
                  .filter((m) => m.category === "social_media")
                  .map((material) => (
                    <Card key={material.id} className="overflow-hidden">
                      <div className="aspect-square bg-slate-100 relative">
                        {material.file_url && (
                          <img
                            src={material.file_url}
                            alt={material.title}
                            className="w-full h-full object-cover"
                          />
                        )}
                        <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setSelectedMaterial(material)}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Ver
                          </Button>
                          <Button size="sm" variant="secondary">
                            <Download className="w-4 h-4 mr-1" />
                            Baixar
                          </Button>
                        </div>
                      </div>
                      <CardContent className="p-3">
                        <h3 className="font-medium text-sm">
                          {material.title}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">
                          {material.description}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* IMPRESSOS */}
        <TabsContent value="flyers">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-500" />
                Material para Impressão
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayMaterials
                  .filter(
                    (m) =>
                      m.category === "flyer" ||
                      m.category === "presentation"
                  )
                  .map((material) => (
                    <Card key={material.id}>
                      <CardContent className="p-3">
                        <h3 className="font-medium text-sm">
                          {material.title}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">
                          {material.description}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full mt-3"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Baixar
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TEXTOS */}
        <TabsContent value="texts">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Copy className="w-5 h-5 text-green-500" />
                Textos Prontos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {textTemplates.map((t, i) => (
                <div key={i} className="border rounded-xl p-4 mb-4">
                  <div className="flex justify-between mb-3">
                    <h3 className="font-semibold">{t.title}</h3>
                    <Button size="sm" onClick={() => copyText(t.content)}>
                      <Copy className="w-4 h-4 mr-2" />
                      Copiar
                    </Button>
                  </div>
                  <pre className="bg-slate-50 rounded-lg p-4 text-sm whitespace-pre-wrap">
                    {t.content}
                  </pre>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* MANUAL */}
        <TabsContent value="manual">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-purple-500" />
                Manual do Franqueado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button className="bg-purple-500 hover:bg-purple-600">
                <Download className="w-4 h-4 mr-2" />
                Baixar Manual
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* PREVIEW */}
      <Dialog
        open={!!selectedMaterial}
        onOpenChange={() => setSelectedMaterial(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedMaterial?.title}</DialogTitle>
          </DialogHeader>

          {selectedMaterial?.file_url && (
            <img
              src={selectedMaterial.file_url}
              alt={selectedMaterial.title}
              className="rounded-xl"
            />
          )}

          <p className="text-slate-600">
            {selectedMaterial?.description}
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
