import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, FolderTree } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { generateSlug } from '@/lib/constants';

interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  sort_order: number | null;
}

interface Subcategory {
  id: string;
  name: string;
  slug: string;
  category_id: string;
}

export default function CategoryManagement() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Category Dialog
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryIcon, setCategoryIcon] = useState('');
  
  // Subcategory Dialog
  const [showSubcategoryDialog, setShowSubcategoryDialog] = useState(false);
  const [editingSubcategory, setEditingSubcategory] = useState<Subcategory | null>(null);
  const [subcategoryName, setSubcategoryName] = useState('');
  const [subcategoryCategoryId, setSubcategoryCategoryId] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (isAdmin === false) {
      navigate('/');
      return;
    }
    if (isAdmin) {
      fetchData();
    }
  }, [user, isAdmin]);

  const fetchData = async () => {
    setIsLoading(true);
    const [catRes, subRes] = await Promise.all([
      supabase.from('categories').select('*').order('sort_order'),
      supabase.from('subcategories').select('*').order('name'),
    ]);
    setCategories(catRes.data || []);
    setSubcategories(subRes.data || []);
    setIsLoading(false);
  };

  // Category CRUD
  const openCategoryDialog = (category?: Category) => {
    if (category) {
      setEditingCategory(category);
      setCategoryName(category.name);
      setCategoryIcon(category.icon || '');
    } else {
      setEditingCategory(null);
      setCategoryName('');
      setCategoryIcon('');
    }
    setShowCategoryDialog(true);
  };

  const saveCategory = async () => {
    if (!categoryName.trim()) return;

    const slug = generateSlug(categoryName);
    
    if (editingCategory) {
      const { error } = await supabase
        .from('categories')
        .update({ name: categoryName, slug, icon: categoryIcon || null })
        .eq('id', editingCategory.id);

      if (error) {
        toast({ title: 'Error', description: 'Failed to update category', variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Category updated' });
      }
    } else {
      const { error } = await supabase
        .from('categories')
        .insert({ name: categoryName, slug, icon: categoryIcon || null });

      if (error) {
        toast({ title: 'Error', description: 'Failed to create category', variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Category created' });
      }
    }

    setShowCategoryDialog(false);
    fetchData();
  };

  const deleteCategory = async (id: string) => {
    if (!confirm('Delete this category? All subcategories and ads in this category will be affected.')) return;

    const { error } = await supabase.from('categories').delete().eq('id', id);
    
    if (error) {
      toast({ title: 'Error', description: 'Failed to delete category', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Category deleted' });
      fetchData();
    }
  };

  // Subcategory CRUD
  const openSubcategoryDialog = (subcategory?: Subcategory) => {
    if (subcategory) {
      setEditingSubcategory(subcategory);
      setSubcategoryName(subcategory.name);
      setSubcategoryCategoryId(subcategory.category_id);
    } else {
      setEditingSubcategory(null);
      setSubcategoryName('');
      setSubcategoryCategoryId(categories[0]?.id || '');
    }
    setShowSubcategoryDialog(true);
  };

  const saveSubcategory = async () => {
    if (!subcategoryName.trim() || !subcategoryCategoryId) return;

    const slug = generateSlug(subcategoryName);
    
    if (editingSubcategory) {
      const { error } = await supabase
        .from('subcategories')
        .update({ name: subcategoryName, slug, category_id: subcategoryCategoryId })
        .eq('id', editingSubcategory.id);

      if (error) {
        toast({ title: 'Error', description: 'Failed to update subcategory', variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Subcategory updated' });
      }
    } else {
      const { error } = await supabase
        .from('subcategories')
        .insert({ name: subcategoryName, slug, category_id: subcategoryCategoryId });

      if (error) {
        toast({ title: 'Error', description: 'Failed to create subcategory', variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Subcategory created' });
      }
    }

    setShowSubcategoryDialog(false);
    fetchData();
  };

  const deleteSubcategory = async (id: string) => {
    if (!confirm('Delete this subcategory?')) return;

    const { error } = await supabase.from('subcategories').delete().eq('id', id);
    
    if (error) {
      toast({ title: 'Error', description: 'Failed to delete subcategory', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Subcategory deleted' });
      fetchData();
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Skeleton className="h-64 w-64" />
      </div>
    );
  }

  return (
    <AdminLayout>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Category Management</h1>
          <p className="text-muted-foreground">Manage categories and subcategories</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => openSubcategoryDialog()} variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Add Subcategory
          </Button>
          <Button onClick={() => openCategoryDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Add Category
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4">
          {categories.map((category) => {
            const subs = subcategories.filter(s => s.category_id === category.id);
            return (
              <Card key={category.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <FolderTree className="h-5 w-5 text-primary" />
                      {category.name}
                      {category.icon && <span className="text-lg">{category.icon}</span>}
                    </CardTitle>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => openCategoryDialog(category)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteCategory(category.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {subs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No subcategories</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {subs.map((sub) => (
                        <div
                          key={sub.id}
                          className="flex items-center gap-1 bg-accent px-3 py-1 rounded-full text-sm"
                        >
                          {sub.name}
                          <button 
                            className="ml-1 hover:text-primary"
                            onClick={() => openSubcategoryDialog(sub)}
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button 
                            className="hover:text-destructive"
                            onClick={() => deleteSubcategory(sub.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Category Dialog */}
      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'Edit Category' : 'New Category'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Category Name</Label>
              <Input
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="e.g., Electronics"
              />
            </div>
            <div className="space-y-2">
              <Label>Icon (emoji)</Label>
              <Input
                value={categoryIcon}
                onChange={(e) => setCategoryIcon(e.target.value)}
                placeholder="e.g., 📱"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCategoryDialog(false)}>
              Cancel
            </Button>
            <Button onClick={saveCategory} disabled={!categoryName.trim()}>
              {editingCategory ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Subcategory Dialog */}
      <Dialog open={showSubcategoryDialog} onOpenChange={setShowSubcategoryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSubcategory ? 'Edit Subcategory' : 'New Subcategory'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Parent Category</Label>
              <Select value={subcategoryCategoryId} onValueChange={setSubcategoryCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Subcategory Name</Label>
              <Input
                value={subcategoryName}
                onChange={(e) => setSubcategoryName(e.target.value)}
                placeholder="e.g., Mobile Phones"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubcategoryDialog(false)}>
              Cancel
            </Button>
            <Button onClick={saveSubcategory} disabled={!subcategoryName.trim() || !subcategoryCategoryId}>
              {editingSubcategory ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
