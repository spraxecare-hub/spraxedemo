'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Category } from '@/lib/supabase/types';
import { Plus, Edit, Trash2, ArrowLeft, ChevronRight, CornerDownRight } from 'lucide-react';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function CategoriesManagement() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    parent_id: 'none', // Use string 'none' for select compatibility
    is_active: true,
    sort_order: 0,
  });

  useEffect(() => {
    if (!user || profile?.role !== 'admin') {
      // router.push('/'); // Uncomment for strict role check
      return;
    }
    fetchCategories();
  }, [user, profile]);

  const fetchCategories = async () => {
    setLoading(true);
    // Fetch ALL categories (parents and children)
    const { data } = await supabase
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true }); // Order by sort_order first
      // Then usually you want alphabetical, but let's stick to user sort first

    if (data) setCategories(data);
    setLoading(false);
  };

  // Helper to separate Parents vs All for Dropdown
  // (We only allow nesting 1 level deep usually, so parents are those without parent_id)
  const potentialParents = categories.filter(c => !c.parent_id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast({
        title: 'Error',
        description: 'Category name is required',
        variant: 'destructive',
      });
      return;
    }

    const slug = formData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const parentId = formData.parent_id === 'none' ? null : formData.parent_id;

    if (selectedCategory) {
      // UPDATE
      const { error } = await supabase
        .from('categories')
        .update({
          name: formData.name,
          slug,
          description: formData.description,
          parent_id: parentId,
          is_active: formData.is_active,
          sort_order: formData.sort_order,
        })
        .eq('id', selectedCategory.id);

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Category updated successfully' });
        fetchCategories();
        handleCloseDialog();
      }
    } else {
      // INSERT
      const { error } = await supabase
        .from('categories')
        .insert({
          name: formData.name,
          slug,
          description: formData.description,
          parent_id: parentId,
          is_active: formData.is_active,
          sort_order: formData.sort_order,
        });

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Category created successfully' });
        fetchCategories();
        handleCloseDialog();
      }
    }
  };

  const handleEdit = (category: Category) => {
    setSelectedCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
      parent_id: category.parent_id || 'none',
      is_active: category.is_active,
      sort_order: category.sort_order,
    });
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedCategory) return;

    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', selectedCategory.id);

    if (error) {
      toast({ title: 'Error', description: 'Failed to delete category (Ensure it has no products)', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Category deleted successfully' });
      fetchCategories();
    }
    setDeleteDialogOpen(false);
    setSelectedCategory(null);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedCategory(null);
    setFormData({
      name: '',
      description: '',
      parent_id: 'none',
      is_active: true,
      sort_order: 0,
    });
  };

  // Organize for Display: Parent -> Children
  const parents = categories.filter(c => !c.parent_id);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 via-white to-gray-50">
      <Header />

      <div className="container mx-auto px-4 py-8 flex-1">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
            <h1 className="text-3xl font-bold">Manage Categories</h1>
          </div>
          <Button
            onClick={() => setDialogOpen(true)}
            className="bg-blue-900 hover:bg-blue-800"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Category
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Categories Hierarchy</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-gray-100 animate-pulse rounded" />)}
              </div>
            ) : categories.length === 0 ? (
              <p className="text-gray-600">No categories yet. Create your first one!</p>
            ) : (
              <div className="space-y-4">
                {parents.map((parent) => {
                  const children = categories.filter(c => c.parent_id === parent.id);
                  return (
                    <div key={parent.id} className="border rounded-lg bg-white overflow-hidden shadow-sm">
                      {/* PARENT ROW */}
                      <div className="flex items-center justify-between p-4 bg-gray-50/50">
                        <div className="flex items-center gap-3">
                           <div className="p-2 bg-blue-100 text-blue-800 rounded-md">
                             <ChevronRight className="w-4 h-4" />
                           </div>
                           <div>
                              <h3 className="font-bold text-gray-900">{parent.name}</h3>
                              <p className="text-xs text-gray-500">Order: {parent.sort_order} • {parent.slug}</p>
                           </div>
                           {!parent.is_active && <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-600 text-xs rounded-full">Inactive</span>}
                        </div>
                        
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(parent)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedCategory(parent); setDeleteDialogOpen(true); }}>
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      </div>

                      {/* CHILDREN ROWS */}
                      {children.length > 0 ? (
                        <div className="divide-y divide-gray-100 border-t border-gray-100">
                           {children.map(child => (
                             <div key={child.id} className="flex items-center justify-between p-3 pl-12 hover:bg-gray-50 transition">
                                <div className="flex items-center gap-3">
                                   <CornerDownRight className="w-4 h-4 text-gray-300" />
                                   <div>
                                      <p className="text-sm font-medium text-gray-700">{child.name}</p>
                                      <p className="text-xs text-gray-400">{child.slug}</p>
                                   </div>
                                   {!child.is_active && <span className="px-2 py-0.5 bg-red-100 text-red-600 text-xs rounded-full">Inactive</span>}
                                </div>
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(child)}>
                                    <Edit className="w-3 h-3 text-gray-500" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSelectedCategory(child); setDeleteDialogOpen(true); }}>
                                    <Trash2 className="w-3 h-3 text-red-400" />
                                  </Button>
                                </div>
                             </div>
                           ))}
                        </div>
                      ) : (
                        <div className="p-2 pl-12 text-xs text-gray-400 italic bg-white">
                           No subcategories
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* CREATE / EDIT DIALOG */}
      <Dialog open={dialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedCategory ? 'Edit Category' : 'Add New Category'}</DialogTitle>
            <DialogDescription>
              {selectedCategory ? 'Update category details' : 'Create a new category. Select a parent to make it a subcategory.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="parent_id">Parent Category</Label>
              <Select 
                value={formData.parent_id} 
                onValueChange={(val) => setFormData({ ...formData, parent_id: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None (Top Level)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (Top Level)</SelectItem>
                  {potentialParents.map(p => (
                    // Prevent setting self as parent
                    <SelectItem key={p.id} value={p.id} disabled={selectedCategory?.id === p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="name">Category Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Electronics"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
              />
            </div>

            <div className="flex gap-4">
               <div className="flex-1">
                  <Label htmlFor="sort_order">Sort Order</Label>
                  <Input
                    id="sort_order"
                    type="number"
                    value={formData.sort_order}
                    onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                  />
               </div>
               <div className="flex items-center space-x-2 pt-6">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label htmlFor="is_active">Active</Label>
               </div>
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button type="submit" className="bg-blue-900 hover:bg-blue-800">
                {selectedCategory ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE ALERT */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{selectedCategory?.name}". 
              If this is a parent category, make sure to delete or move its subcategories first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
