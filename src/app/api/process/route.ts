import Replicate from "replicate";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('image') as File | null;
    
    if (!file) {
      return Response.json({ error: "No image provided" }, { status: 400 });
    }

    // Chế độ DEMO: tự động trả về ảnh mẫu nếu bạn chưa có API Token thực
    if (!process.env.REPLICATE_API_TOKEN || process.env.REPLICATE_API_TOKEN === "your_replicate_token_here") {
      console.log("Using MOCK Replicate response for demo purposes...");
      
      // Giả lập thời gian AI đang xử lý (3.5 giây)
      await new Promise(resolve => setTimeout(resolve, 3500));
      
      // Trả về một ảnh chất lượng cao 4K để demo giao diện
      return Response.json({ 
        result: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop" 
      });
    }

    const bytes = await file.arrayBuffer();
    const base64Image = Buffer.from(bytes).toString('base64');
    const mimeType = file.type || 'image/jpeg';
    const dataUri = `data:${mimeType};base64,${base64Image}`;

    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    });

    const output = await replicate.run(
      "nightmareai/real-esrgan:42fed5c4a4ce23f822ac44f2fb9f65b1119cc96eb51ef922c2627931f7375276",
      {
        input: {
          image: dataUri,
          scale: 4,
          face_enhance: false
        }
      }
    );

    // output is typically a URL string for this model
    return Response.json({ result: output });
  } catch (error: any) {
    console.error("Replicate API Error:", error);
    return Response.json({ error: error.message || "Failed to process image" }, { status: 500 });
  }
}
