interface Props { params: Promise<{ id: string }> }
import BlogPostForm from "@/components/blog/BlogPostForm";
export default async function EditPostPage({ params }: Props) {
  const { id } = await params;
  return <BlogPostForm postId={id} />;
}
