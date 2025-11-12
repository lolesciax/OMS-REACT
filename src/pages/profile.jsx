import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../styles/profile.css';
import Footer from '../components/Footer';

function Profile() {
    const navigate = useNavigate();
    const fileInputRef = useRef(null);
    const [user, setUser] = useState(null);
    const [addresses, setAddresses] = useState([]);
    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [showAddAddress, setShowAddAddress] = useState(false);
    const [newAddress, setNewAddress] = useState({
        title: '',
        street: '',
        barangay: '',
        city: '',
        province: ''
    });
    const [isUploading, setIsUploading] = useState(false);
    const [shippingFee, setShippingFee] = useState(50.00); // Default shipping fee

   // Philippine provinces and cities data 
const philippineLocations = {
    provinces: [
        'Metro Manila', 'Abra', 'Agusan del Norte', 'Agusan del Sur', 'Aklan', 'Albay', 'Antique',
        'Apayao', 'Aurora', 'Bataan', 'Batanes', 'Batangas', 'Benguet', 'Biliran',
        'Bohol', 'Bukidnon', 'Bulacan', 'Cagayan', 'Camarines Norte', 'Camarines Sur', 'Camiguin',
        'Capiz', 'Catanduanes', 'Cavite', 'Cebu', 'Cotabato', 'Davao del Norte',
        'Davao del Sur', 'Davao Occidental', 'Davao Oriental', 'Eastern Samar',
        'Guimaras', 'Ifugao', 'Ilocos Norte', 'Ilocos Sur', 'Iloilo', 'Isabela', 'Kalinga', 'La Union',
        'Laguna', 'Lanao del Norte', 'Leyte', 'Marinduque',
        'Masbate', 'Misamis Occidental', 'Misamis Oriental', 'Mountain Province', 'Negros Occidental',
        'Negros Oriental', 'Northern Samar', 'Nueva Ecija', 'Nueva Vizcaya', 'Occidental Mindoro',
        'Oriental Mindoro', 'Palawan', 'Pampanga', 'Pangasinan', 'Quezon', 'Quirino', 'Rizal',
        'Romblon', 'Samar', 'Sarangani', 'Siquijor', 'Sorsogon', 'South Cotabato', 'Southern Leyte',
        'Sultan Kudarat', 'Surigao del Norte', 'Surigao del Sur', 'Tarlac',
        'Zambales', 'Zamboanga del Norte', 'Zamboanga del Sur', 'Zamboanga Sibugay'
    ],
    cities: {
        'Metro Manila': [
            'Caloocan', 'Las Piñas', 'Makati', 'Malabon', 'Mandaluyong', 'Manila', 'Marikina',
            'Muntinlupa', 'Navotas', 'Parañaque', 'Pasay', 'Pasig', 'Pateros', 'Quezon City',
            'San Juan', 'Taguig', 'Valenzuela'
        ],
        'Abra': ['Bangued', 'Boliney', 'Bucay', 'Bucloc', 'Daguioman', 'Danglas', 'Dolores', 'La Paz', 'Lacub', 'Lagangilang', 'Lagayan', 'Langiden', 'Licuan-Baay', 'Luba', 'Malibcong', 'Manabo', 'Peñarrubia', 'Pidigan', 'Pilar', 'Sallapadan', 'San Isidro', 'San Juan', 'San Quintin', 'Tayum', 'Tineg', 'Tubo', 'Villaviciosa'],
        'Cavite': [
            'Bacoor', 'Cavite City', 'Dasmariñas', 'Imus', 'Tagaytay', 'Trece Martires City',
            'Alfonso', 'Amadeo', 'Carmona', 'General Mariano Alvarez', 'General Trias', 'Indang',
            'Kawit', 'Magallanes', 'Maragondon', 'Mendez', 'Naic', 'Noveleta', 'Rosario', 'Silang',
            'Tanza', 'Ternate'
        ],
        'Laguna': [
            'Biñan', 'Cabuyao', 'Calamba', 'San Pablo', 'Santa Rosa', 'Alaminos', 'Bay', 'Calauan',
            'Cavinti', 'Famy', 'Kalayaan', 'Liliw', 'Los Baños', 'Luisiana', 'Lumban', 'Mabitac',
            'Magdalena', 'Majayjay', 'Nagcarlan', 'Paete', 'Pagsanjan', 'Pakil', 'Pangil', 'Pila',
            'Rizal', 'San Pedro', 'Santa Cruz', 'Santa Maria', 'Siniloan', 'Victoria'
        ],
        'Bulacan': [
            'Malolos', 'Meycauayan', 'San Jose del Monte', 'Angat', 'Balagtas', 'Baliuag', 'Bocaue',
            'Bulacan', 'Bustos', 'Calumpit', 'Doña Remedios Trinidad', 'Guiguinto', 'Hagonoy',
            'Marilao', 'Norzagaray', 'Obando', 'Pandi', 'Paombong', 'Plaridel', 'Pulilan', 'San Ildefonso',
            'San Miguel', 'San Rafael', 'Santa Maria'
        ],
        'Batangas': [
            'Batangas City', 'Lipa', 'Tanauan', 'Bauan', 'Calaca', 'Lemery', 'Nasugbu', 'Balayan',
            'Cuenca', 'Ibaan', 'Laurel', 'Mabini', 'Malvar', 'Mataasnakahoy', 'Padre Garcia', 'Rosario',
            'San Jose', 'San Juan', 'San Luis', 'San Nicolas', 'San Pascual', 'Santo Tomas', 'Taal',
            'Talisay', 'Taysan', 'Tingloy', 'Tuy'
        ],
        'Rizal': [
            'Antipolo', 'Angono', 'Baras', 'Binangonan', 'Cainta', 'Cardona', 'Jalajala', 'Morong',
            'Pililla', 'Rodriguez', 'San Mateo', 'Tanay', 'Taytay', 'Teresa'
        ],
        'Pampanga': [
            'Angeles', 'San Fernando', 'Apalit', 'Arayat', 'Bacolor', 'Candaba', 'Floridablanca',
            'Guagua', 'Lubao', 'Mabalacat', 'Macabebe', 'Magalang', 'Masantol', 'Mexico', 'Minalin',
            'Porac', 'San Luis', 'San Simon', 'Santa Ana', 'Santa Rita', 'Santo Tomas', 'Sasmuan'
        ],
        'Cebu': [
            'Cebu City', 'Lapu-Lapu', 'Mandaue', 'Bogo', 'Carcar', 'Danao', 'Talisay', 'Toledo',
            'Alcantara', 'Alcoy', 'Alegria', 'Aloguinsan', 'Argao', 'Asturias', 'Badian', 'Balamban',
            'Bantayan', 'Barili', 'Boljoon', 'Borbon', 'Carmen', 'Catmon', 'Compostela', 'Consolacion',
            'Cordoba', 'Daanbantayan', 'Dalaguete', 'Dumanjug', 'Ginatilan', 'Liloan', 'Madridejos',
            'Malabuyoc', 'Medellin', 'Minglanilla', 'Moalboal', 'Oslob', 'Pilar', 'Pinamungahan',
            'Poro', 'Ronda', 'Samboan', 'San Fernando', 'San Francisco', 'San Remigio', 'Santa Fe',
            'Santander', 'Sibonga', 'Sogod', 'Tabogon', 'Tabuelan', 'Tuburan', 'Tudela'
        ]
    }
};

    // Shipping fee information
    const shippingInfo = {
        'Metro Manila': { fee: 50.00, region: 'Metro Manila' },
        'Abra': { fee: 80.00, region: 'Luzon' },
        'Albay': { fee: 80.00, region: 'Luzon' },
        'Apayao': { fee: 80.00, region: 'Luzon' },
        'Aurora': { fee: 80.00, region: 'Luzon' },
        'Bataan': { fee: 80.00, region: 'Luzon' },
        'Batanes': { fee: 80.00, region: 'Luzon' },
        'Batangas': { fee: 80.00, region: 'Luzon' },
        'Benguet': { fee: 80.00, region: 'Luzon' },
        'Bulacan': { fee: 80.00, region: 'Luzon' },
        'Cagayan': { fee: 80.00, region: 'Luzon' },
        'Camarines Norte': { fee: 80.00, region: 'Luzon' },
        'Camarines Sur': { fee: 80.00, region: 'Luzon' },
        'Catanduanes': { fee: 80.00, region: 'Luzon' },
        'Cavite': { fee: 80.00, region: 'Luzon' },
        'Ifugao': { fee: 80.00, region: 'Luzon' },
        'Ilocos Norte': { fee: 80.00, region: 'Luzon' },
        'Ilocos Sur': { fee: 80.00, region: 'Luzon' },
        'Isabela': { fee: 80.00, region: 'Luzon' },
        'Kalinga': { fee: 80.00, region: 'Luzon' },
        'La Union': { fee: 80.00, region: 'Luzon' },
        'Laguna': { fee: 80.00, region: 'Luzon' },
        'Marinduque': { fee: 80.00, region: 'Luzon' },
        'Masbate': { fee: 80.00, region: 'Luzon' },
        'Mountain Province': { fee: 80.00, region: 'Luzon' },
        'Nueva Ecija': { fee: 80.00, region: 'Luzon' },
        'Nueva Vizcaya': { fee: 80.00, region: 'Luzon' },
        'Occidental Mindoro': { fee: 80.00, region: 'Luzon' },
        'Oriental Mindoro': { fee: 80.00, region: 'Luzon' },
        'Palawan': { fee: 80.00, region: 'Luzon' },
        'Pampanga': { fee: 80.00, region: 'Luzon' },
        'Pangasinan': { fee: 80.00, region: 'Luzon' },
        'Quezon': { fee: 80.00, region: 'Luzon' },
        'Quirino': { fee: 80.00, region: 'Luzon' },
        'Rizal': { fee: 80.00, region: 'Luzon' },
        'Romblon': { fee: 80.00, region: 'Luzon' },
        'Sorsogon': { fee: 80.00, region: 'Luzon' },
        'Tarlac': { fee: 80.00, region: 'Luzon' },
        'Zambales': { fee: 80.00, region: 'Luzon' },
        'Aklan': { fee: 120.00, region: 'Visayas' },
        'Antique': { fee: 120.00, region: 'Visayas' },
        'Biliran': { fee: 120.00, region: 'Visayas' },
        'Bohol': { fee: 120.00, region: 'Visayas' },
        'Capiz': { fee: 120.00, region: 'Visayas' },
        'Cebu': { fee: 120.00, region: 'Visayas' },
        'Eastern Samar': { fee: 120.00, region: 'Visayas' },
        'Guimaras': { fee: 120.00, region: 'Visayas' },
        'Iloilo': { fee: 120.00, region: 'Visayas' },
        'Leyte': { fee: 120.00, region: 'Visayas' },
        'Negros Occidental': { fee: 120.00, region: 'Visayas' },
        'Negros Oriental': { fee: 120.00, region: 'Visayas' },
        'Northern Samar': { fee: 120.00, region: 'Visayas' },
        'Samar': { fee: 120.00, region: 'Visayas' },
        'Siquijor': { fee: 120.00, region: 'Visayas' },
        'Southern Leyte': { fee: 120.00, region: 'Visayas' },
        'Agusan del Norte': { fee: 150.00, region: 'Mindanao' },
        'Agusan del Sur': { fee: 150.00, region: 'Mindanao' },
        'Bukidnon': { fee: 150.00, region: 'Mindanao' },
        'Camiguin': { fee: 150.00, region: 'Mindanao' },
        'Cotabato': { fee: 150.00, region: 'Mindanao' },
        'Davao del Norte': { fee: 150.00, region: 'Mindanao' },
        'Davao del Sur': { fee: 150.00, region: 'Mindanao' },
        'Davao Occidental': { fee: 150.00, region: 'Mindanao' },
        'Davao Oriental': { fee: 150.00, region: 'Mindanao' },
        'Lanao del Norte': { fee: 150.00, region: 'Mindanao' },
        'Misamis Occidental': { fee: 150.00, region: 'Mindanao' },
        'Misamis Oriental': { fee: 150.00, region: 'Mindanao' },
        'Sarangani': { fee: 150.00, region: 'Mindanao' },
        'South Cotabato': { fee: 150.00, region: 'Mindanao' },
        'Sultan Kudarat': { fee: 150.00, region: 'Mindanao' },
        'Surigao del Norte': { fee: 150.00, region: 'Mindanao' },
        'Surigao del Sur': { fee: 150.00, region: 'Mindanao' },
        'Zamboanga del Norte': { fee: 150.00, region: 'Mindanao' },
        'Zamboanga del Sur': { fee: 150.00, region: 'Mindanao' },
        'Zamboanga Sibugay': { fee: 150.00, region: 'Mindanao' }
    };

    // Get user ID from localStorage
    const getUserId = () => {
        const userData = localStorage.getItem('user');
        if (userData) {
            const parsedUser = JSON.parse(userData);
            return parsedUser.username || parsedUser.user_id || parsedUser._id;
        }
        return null;
    };

    // Calculate shipping fee based on province
    const calculateShippingFee = async (province) => {
        if (!province) return 50.00;
        
        try {
            const response = await fetch('http://localhost:5000/api/orders/calculate-shipping', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ province })
            });
            
            const data = await response.json();
            
            if (data.success) {
                return data.shippingFee;
            } else {
                // Fallback to client-side calculation
                return shippingInfo[province]?.fee || 120.00;
            }
        } catch (error) {
            console.error('Error calculating shipping fee:', error);
            // Fallback to client-side calculation
            return shippingInfo[province]?.fee || 120.00;
        }
    };

    // Update checkout address in localStorage
    const updateCheckoutAddress = async (address, userData) => {
        if (address && userData) {
            // Calculate shipping fee for the province
            const shippingFee = await calculateShippingFee(address.province);
            
            const checkoutAddress = {
                recipient: `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || userData.username,
                contact: userData.phone || '', // Use phone from profile instead of address
                street: address.street,
                barangay: address.barangay,
                city: address.city,
                province: address.province,
                shippingFee: shippingFee,
                region: shippingInfo[address.province]?.region || 'Unknown Region'
            };
            localStorage.setItem('userAddress', JSON.stringify(checkoutAddress));
            console.log('✅ Checkout address updated in localStorage:', checkoutAddress);
        }
    };

    // Load user profile from database
    const loadUserProfile = async () => {
        try {
            setIsLoading(true);
            const userId = getUserId();
            
            if (!userId) {
                console.error('No user ID found');
                navigate('/login');
                return;
            }

            console.log('🔍 Loading profile from database for:', userId);
            
            const response = await fetch(`http://localhost:5000/api/users/profile/${userId}`);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to load profile');
            }
            
            console.log('✅ Profile loaded from database:', data.user);
            
            // Set user data from database
            setUser(data.user);
            
            // Set addresses from database or empty array
            if (data.user.addresses && Array.isArray(data.user.addresses)) {
                setAddresses(data.user.addresses);
                // Update checkout address if address exists
                if (data.user.addresses.length > 0) {
                    await updateCheckoutAddress(data.user.addresses[0], data.user);
                }
            } else {
                setAddresses([]);
            }
            
        } catch (error) {
            console.error('❌ Error loading profile from database:', error);
            // Fallback to localStorage if database fails
            loadFromLocalStorage();
        } finally {
            setIsLoading(false);
        }
    };

    // Fallback: Load from localStorage
    const loadFromLocalStorage = () => {
        try {
            const userData = localStorage.getItem('user');
            if (userData) {
                const parsedUser = JSON.parse(userData);
                setUser(parsedUser);
                setAddresses(parsedUser.addresses || []);
                console.log('📁 Loaded from localStorage fallback');
            }
        } catch (error) {
            console.error('Error loading from localStorage:', error);
            navigate('/login');
        }
    };

    // Save profile to database
    const saveProfileToDatabase = async (userData) => {
        try {
            const userId = getUserId();
            if (!userId) {
                throw new Error('No user ID found');
            }

            console.log('💾 Saving profile to database for:', userId);
            console.log('📦 Profile data:', userData);

            const response = await fetch(`http://localhost:5000/api/users/profile/${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(userData)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to save profile');
            }

            console.log('✅ Profile saved to database:', data);
            return data;
            
        } catch (error) {
            console.error('❌ Error saving profile to database:', error);
            throw error;
        }
    };

    // Save address to database
    const saveAddressToDatabase = async (addressesData) => {
        try {
            const userId = getUserId();
            if (!userId) {
                throw new Error('No user ID found');
            }

            console.log('💾 Saving address to database for:', userId);
            console.log('📦 Address data:', addressesData);

            const response = await fetch(`http://localhost:5000/api/users/profile/${userId}/address`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ addresses: addressesData })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to save address');
            }

            console.log('✅ Address saved to database:', data);
            return data;
            
        } catch (error) {
            console.error('❌ Error saving address to database:', error);
            throw error;
        }
    };

    // Load user data on component mount
    useEffect(() => {
        loadUserProfile();
    }, [navigate]);

    // Handler for profile picture upload
    const handleProfilePictureUpload = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Please select a valid image file.');
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('Please select an image smaller than 5MB.');
            return;
        }

        setIsUploading(true);

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const imageDataUrl = e.target.result;
                
                // Update user state with new profile picture
                const updatedUser = {
                    ...user,
                    profilePic: imageDataUrl
                };
                
                setUser(updatedUser);
                
                // Save to database
                await saveProfileToDatabase({
                    profilePic: imageDataUrl
                });
                
                alert('Profile picture updated successfully!');
                
            } catch (error) {
                alert('Failed to save profile picture. Please try again.');
            } finally {
                setIsUploading(false);
            }
        };

        reader.onerror = () => {
            setIsUploading(false);
            alert('Error uploading profile picture. Please try again.');
        };

        reader.readAsDataURL(file);
    };

    // Trigger file input click
    const handleEditPictureClick = () => {
        fileInputRef.current?.click();
    };

    // Handler for form changes
    const handleFormChange = (e) => {
        const { name, value } = e.target;
        
        // Phone number validation
        if (name === 'phone') {
            // Only allow numbers
            const numbersOnly = value.replace(/\D/g, '');
            
            // Limit to 11 characters and must start with 09
            if (numbersOnly.length <= 11) {
                if (numbersOnly === '' || numbersOnly.startsWith('09')) {
                    const updatedUser = {
                        ...user,
                        [name]: numbersOnly
                    };
                    setUser(updatedUser);
                }
            }
        } else {
            const updatedUser = {
                ...user,
                [name]: value
            };
            setUser(updatedUser);
        }
    };

    // Handler for new address form changes
    const handleNewAddressChange = async (e) => {
        const { name, value } = e.target;
        
        // If province changes, reset city and calculate shipping fee
        if (name === 'province') {
            const updatedAddress = {
                ...newAddress,
                province: value,
                city: '' // Reset city when province changes
            };
            
            setNewAddress(updatedAddress);
            
            // Calculate and update shipping fee
            if (value) {
                const fee = await calculateShippingFee(value);
                setShippingFee(fee);
            }
        } else {
            setNewAddress(prev => ({
                ...prev,
                [name]: value
            }));
        }
    };

    // Handler for saving profile changes
    const handleProfileSubmit = async (e) => {
        e.preventDefault();
        
        // Validate phone number before saving
        if (user.phone && !/^09\d{9}$/.test(user.phone)) {
            alert('Please enter a valid Philippine phone number starting with 09 and exactly 11 digits.');
            return;
        }
        
        try {
            setIsLoading(true);
            console.log("Saving user data to database:", user);
            
            // Validate user data
            if (!user) {
                throw new Error('No user data to save');
            }

            // Prepare profile data for database
            const profileData = {
                firstName: user.firstName || '',
                lastName: user.lastName || '',
                phone: user.phone || '',
                gender: user.gender || '',
                dob: user.dob || '',
                profilePic: user.profilePic || '/default-avatar.jpg',
                addresses: addresses
            };
            
            // Save to database
            const result = await saveProfileToDatabase(profileData);
            
            // Update local user state with response data if available
            if (result.user) {
                setUser(result.user);
            }
            
            alert('Profile updated successfully!');
            setIsEditing(false);
        } catch (error) {
            console.error('Error updating profile:', error);
            alert('Failed to update profile. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    // Handler for adding/updating address
    const handleAddAddress = async (e) => {
        e.preventDefault();
        
        // Validate required fields (phone removed from address validation)
        if (!newAddress.title || !newAddress.street || !newAddress.barangay || !newAddress.city || !newAddress.province) {
            alert('Please fill in all required address fields.');
            return;
        }

        const address = {
            id: Date.now().toString(),
            ...newAddress
        };

        // Only allow one address - replace existing one
        const updatedAddresses = [address];
        
        try {
            // Save address to database
            await saveAddressToDatabase(updatedAddresses);
            
            // Update local state
            setAddresses(updatedAddresses);
            
            // Update user data with new addresses
            const updatedUser = {
                ...user,
                addresses: updatedAddresses
            };
            setUser(updatedUser);
            
            // Also save as default shipping address for checkout
            await updateCheckoutAddress(address, updatedUser);
            
            // Reset form
            setNewAddress({ 
                title: '', 
                street: '', 
                barangay: '', 
                city: '', 
                province: '' 
            });
            setShowAddAddress(false);
            alert('Address saved successfully! It has been set as your default shipping address.');
            
        } catch (error) {
            console.error('Error saving address:', error);
            alert('Failed to save address. Please try again.');
        }
    };

    // Handler for removing the address
    const handleRemoveAddress = async (id) => {
        if (window.confirm('Are you sure you want to delete your address?')) {
            try {
                const updatedAddresses = [];
                
                // Save empty addresses to database
                await saveAddressToDatabase(updatedAddresses);
                
                // Update local state
                setAddresses(updatedAddresses);
                
                // Update user data
                const updatedUser = {
                    ...user,
                    addresses: updatedAddresses
                };
                setUser(updatedUser);
                
                // Also remove from checkout address
                localStorage.removeItem('userAddress');
                
                alert('Address removed successfully!');
                
            } catch (error) {
                alert('Failed to remove address. Please try again.');
            }
        }
    };

    // Handler for editing the address
    const handleEditAddress = async (address) => {
        setNewAddress({
            title: address.title,
            street: address.street,
            barangay: address.barangay,
            city: address.city,
            province: address.province
        });
        
        // Calculate shipping fee for the province being edited
        if (address.province) {
            const fee = await calculateShippingFee(address.province);
            setShippingFee(fee);
        }
        
        setShowAddAddress(true);
    };

    // Handler for setting address as default for checkout
    const handleSetDefaultAddress = async () => {
        if (addresses.length === 0) {
            alert('No address available. Please add an address first.');
            return;
        }

        const address = addresses[0];
        await updateCheckoutAddress(address, user);
        alert('Address set as default shipping address!');
    };

    // Handler for changing email/phone
    const handleChangeContact = (type) => {
        alert(`Change ${type} functionality would be implemented here with verification.`);
    };

    // Handler for logging out
    const handleLogout = () => {
        if (window.confirm('Are you sure you want to log out?')) {
            // Only clear authentication data, keep checkout address
            localStorage.removeItem('user');
            localStorage.removeItem('isLoggedIn');
            localStorage.removeItem('loginTime');
            
            navigate('/login');
        }
    };

    // Mask email for privacy
    const maskEmail = (email) => {
        if (!email) return '';
        const [localPart, domain] = email.split('@');
        if (localPart.length <= 2) return email;
        
        const maskedLocal = localPart.charAt(0) + '*'.repeat(localPart.length - 2) + localPart.charAt(localPart.length - 1);
        return `${maskedLocal}@${domain}`;
    };

    // Format address for display
    const formatAddress = (address) => {
        const parts = [
            address.street,
            address.barangay ? `Brgy. ${address.barangay}` : '',
            address.city,
            address.province
        ].filter(part => part !== '');
        
        return parts.join(', ');
    };

    // Get shipping info for display
    const getShippingInfo = (province) => {
        if (!province) return null;
        return shippingInfo[province] || { fee: 120.00, region: 'Unknown Region' };
    };

    // Get cities based on selected province
    const getCitiesForProvince = (province) => {
        return philippineLocations.cities[province] || [];
    };

    // Component for the address card
    const AddressCard = ({ address }) => {
        const shippingInfo = getShippingInfo(address.province);
        
        return (
            <div className="address-card">
                <div className="address-header">
                    <h4>{address.title}</h4>
                    <span className="default-badge">Default Address</span>
                </div>
                <p className="address-text">{formatAddress(address)}</p>
                {shippingInfo && (
                    <div className="shipping-info">
                        <small>
                            📦 Shipping to {shippingInfo.region}: ₱{shippingInfo.fee.toFixed(2)}
                        </small>
                    </div>
                )}
                <div className="address-actions">
                    <button 
                        type="button" 
                        className="set-default-btn"
                        onClick={handleSetDefaultAddress}
                    >
                        Set as Shipping Address
                    </button>
                    <button 
                        type="button" 
                        className="edit-btn"
                        onClick={() => handleEditAddress(address)}
                    >
                        Edit
                    </button>
                    <button 
                        type="button" 
                        className="delete-btn"
                        onClick={() => handleRemoveAddress(address.id)}
                    >
                        Delete
                    </button>
                </div>
            </div>
        );
    };

    if (isLoading) {
        return (
            <div className="loading-container">
                <header className="header">
                    <div className="header-left">
                        <img src="/Shop Icon.jpg" alt="Logo" className="logo" />
                        <h2>Old Goods Thrift</h2>
                    </div>
                    <Link to="/shopping" className="back-link">Back to Shop</Link>
                </header>
                <div className="loading">Loading profile...</div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="error-container">
                <header className="header">
                    <div className="header-left">
                        <img src="/Shop Icon.jpg" alt="Logo" className="logo" />
                        <h2>Old Goods Thrift</h2>
                    </div>
                    <Link to="/shopping" className="back-link">Back to Shop</Link>
                </header>
                <div className="error-message">
                    <h3>Please log in to view your profile</h3>
                    <Link to="/login" className="btn-primary">Log In</Link>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* Hidden file input for profile picture */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleProfilePictureUpload}
                accept="image/*"
                style={{ display: 'none' }}
            />

            {/* HEADER */}
            <header className="header">
                <div className="header-left">
                    <img src="/Shop Icon.jpg" alt="Logo" className="logo" />
                    <h2>Old Goods Thrift</h2>
                </div>
                <Link to="/shopping" className="back-link">Back to Shop</Link>
            </header>

            {/* MAIN PROFILE SECTION */}
            <div className="profile-container">
                {/* SIDEBAR */}
                <aside className="sidebar">
                    <div className="user-info">
                        <div className="profile-picture-container">
                            <img 
                                src={user.profilePic} 
                                alt="Profile" 
                                className="user-pic" 
                            />
                            <div className="profile-picture-overlay">
                                <button 
                                    className="edit-picture-btn"
                                    onClick={handleEditPictureClick}
                                    disabled={isUploading}
                                >
                                    {isUploading ? '📤' : '📷'}
                                </button>
                            </div>
                        </div>
                        <h3>@{user.username}</h3>
                        <button 
                            type="button" 
                            className="edit-link" 
                            onClick={() => setIsEditing(!isEditing)}
                        >
                            {isEditing ? 'Cancel Edit' : 'Edit Profile'}
                        </button>
                    </div>

                    <nav className="menu">
                        <h4>My Account</h4>
                        <ul>
                            <li className="active"><Link to="/profile">Profile</Link></li>
                        </ul>

                        <h4>My Purchase</h4>
                        <ul>
                            <li><Link to="/order-history">My Orders</Link></li>
                            <li><Link to="/cart">Shopping Cart</Link></li>
                        </ul>

                        {/* Logout at the bottom */}
                        <div className="menu-footer">
                            <button className="menu-logout" onClick={handleLogout}>
                                🚪 Log Out
                            </button>
                        </div>
                    </nav>
                </aside>

                {/* PROFILE CONTENT */}
                <main className="profile-content">
                    <h2>My Profile</h2>
                    <p>Manage your account information</p>

                    <form className="profile-form" onSubmit={handleProfileSubmit}>
                        
                        {/* USERNAME */}
                        <div className="form-group">
                            <label>Username</label>
                            <input 
                                type="text" 
                                value={user.username || ''} 
                                readOnly 
                                className="readonly-input" 
                            />
                        </div>

                        {/* NAME */}
                        <div className="form-group">
                            <label>Name</label>
                            <div className="name-fields">
                                <input 
                                    type="text" 
                                    placeholder="First Name"
                                    name="firstName"
                                    value={user.firstName || ''}
                                    onChange={handleFormChange}
                                    readOnly={!isEditing}
                                />
                                <input 
                                    type="text" 
                                    placeholder="Last Name" 
                                    name="lastName"
                                    value={user.lastName || ''}
                                    onChange={handleFormChange}
                                    readOnly={!isEditing}
                                />
                            </div>
                        </div>

                        {/* EMAIL - Masked for privacy */}
                        <div className="form-group">
                            <label>Email</label>
                            <div className="field-with-btn">
                                <input 
                                    type="email" 
                                    value={maskEmail(user.email || '')} 
                                    readOnly 
                                    className="readonly-input" 
                                />
                                <button 
                                    type="button" 
                                    className="change-btn"
                                    onClick={() => handleChangeContact('email')}
                                >
                                    Change
                                </button>
                            </div>
                        </div>

                        {/* PHONE NUMBER */}
                        <div className="form-group">
                            <label>Phone Number</label>
                            <div className="field-with-btn">
                                <input 
                                    type="tel" 
                                    name="phone"
                                    placeholder="09XXXXXXXXX"
                                    value={user.phone || ''}
                                    onChange={handleFormChange}
                                    readOnly={!isEditing}
                                    maxLength="11"
                                    pattern="09[0-9]{9}"
                                />
                                {!isEditing && (
                                    <button 
                                        type="button" 
                                        className="change-btn"
                                        onClick={() => handleChangeContact('phone')}
                                    >
                                        Change
                                    </button>
                                )}
                            </div>
                            
                        </div>

                        {/* GENDER */}
                        <div className="form-group">
                            <label>Gender</label>
                            <div className="gender-options">
                                <label>
                                    <input 
                                        type="radio" 
                                        name="gender" 
                                        value="Male" 
                                        checked={user.gender === 'Male'} 
                                        onChange={handleFormChange}
                                        disabled={!isEditing}
                                    /> 
                                    Male
                                </label>
                                <label>
                                    <input 
                                        type="radio" 
                                        name="gender" 
                                        value="Female" 
                                        checked={user.gender === 'Female'} 
                                        onChange={handleFormChange}
                                        disabled={!isEditing}
                                    /> 
                                    Female
                                </label>
                                <label>
                                    <input 
                                        type="radio" 
                                        name="gender" 
                                        value="Other" 
                                        checked={user.gender === 'Other'} 
                                        onChange={handleFormChange}
                                        disabled={!isEditing}
                                    /> 
                                    Other
                                </label>
                            </div>
                        </div>

                        {/* DATE OF BIRTH */}
                        <div className="form-group">
                            <label>Date of Birth</label>
                            <div className="field-with-btn">
                                <input 
                                    type="date" 
                                    name="dob"
                                    value={user.dob || ''}
                                    onChange={handleFormChange}
                                    readOnly={!isEditing}
                                />
                            </div>
                        </div>

                        {/* SAVE BUTTON - Only visible when editing */}
                        {isEditing && (
                            <button 
                                type="submit" 
                                className="save-btn"
                                disabled={isLoading}
                            >
                                {isLoading ? 'Saving...' : 'Save Changes'}
                            </button>
                        )}
                    </form>

                    {/* ADDRESSES SECTION */}
                    <section className="addresses-section">
                        <div className="addresses-header">
                            <h3>My Address {addresses.length > 0 && '(1/1)'}</h3> 
                            {addresses.length === 0 && (
                                <button 
                                    type="button" 
                                    className="add-address-btn"
                                    onClick={() => setShowAddAddress(true)}
                                >
                                    + Add Address
                                </button>
                            )}
                        </div>

                        {/* Add Address Form */}
                        {showAddAddress && (
                            <form className="add-address-form" onSubmit={handleAddAddress}>
                                <h4>Add Your Address</h4>
                                <p className="form-note">You can only have one address. All fields are required.</p>
                                
                                <input 
                                    type="text" 
                                    name="title"
                                    placeholder="Address Title (e.g., Home, Office) *"
                                    value={newAddress.title}
                                    onChange={handleNewAddressChange}
                                    required
                                />
                                <input 
                                    type="text" 
                                    name="street"
                                    placeholder="Street Address *"
                                    value={newAddress.street}
                                    onChange={handleNewAddressChange}
                                    required
                                />
                                <input 
                                    type="text" 
                                    name="barangay"
                                    placeholder="Barangay *"
                                    value={newAddress.barangay}
                                    onChange={handleNewAddressChange}
                                    required
                                />
                                
                                {/* Province Dropdown */}
                                <div className="form-row">
                                    <div className="form-group-dropdown">
                                        <label>Province *</label>
                                        <select
                                            name="province"
                                            value={newAddress.province}
                                            onChange={handleNewAddressChange}
                                            required
                                        >
                                            <option value="">Select Province</option>
                                            {philippineLocations.provinces.map(province => (
                                                <option key={province} value={province}>
                                                    {province}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* City Dropdown - Only show if province is selected */}
                                    <div className="form-group-dropdown">
                                        <label>City/Municipality *</label>
                                        <select
                                            name="city"
                                            value={newAddress.city}
                                            onChange={handleNewAddressChange}
                                            required
                                            disabled={!newAddress.province}
                                        >
                                            <option value="">Select City</option>
                                            {newAddress.province && getCitiesForProvince(newAddress.province).map(city => (
                                                <option key={city} value={city}>
                                                    {city}
                                                </option>
                                            ))}
                                        </select>
                                        {!newAddress.province && (
                                            <small className="field-note">Select a province first</small>
                                        )}
                                    </div>
                                </div>

                                {/* Shipping Fee Display */}
                                {newAddress.province && (
                                    <div className="shipping-fee-display">
                                        <div className="shipping-info-card">
                                            <h5>📦 Shipping Information</h5>
                                            <p>
                                                <strong>Region:</strong> {getShippingInfo(newAddress.province).region}
                                            </p>
                                            <p>
                                                <strong>Shipping Fee:</strong> ₱{shippingFee.toFixed(2)}
                                            </p>
                                            <small>
                                                Shipping fees vary by region: 
                                                Metro Manila (₱50), Luzon (₱80), Visayas (₱120), Mindanao (₱150)
                                            </small>
                                        </div>
                                    </div>
                                )}

                                <div className="address-form-actions">
                                    <button type="submit" className="save-address-btn">
                                        {addresses.length > 0 ? 'Update Address' : 'Save Address'}
                                    </button>
                                    <button 
                                        type="button" 
                                        className="cancel-btn"
                                        onClick={() => {
                                            setShowAddAddress(false);
                                            setNewAddress({ 
                                                title: '', 
                                                street: '', 
                                                barangay: '', 
                                                city: '', 
                                                province: '' 
                                            });
                                            setShippingFee(50.00);
                                        }}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* Address List */}
                        <div className="address-list"> 
                            {addresses.length > 0 ? (
                                addresses.map(addr => (
                                    <AddressCard key={addr.id} address={addr} />
                                ))
                            ) : (
                                <div className="no-addresses">
                                    <p>No address saved yet.</p>
                                    <p className="address-note">Add your address to enable checkout functionality.</p>
                                    <button 
                                        type="button" 
                                        className="add-address-btn"
                                        onClick={() => setShowAddAddress(true)}
                                    >
                                        + Add Your First Address
                                    </button>
                                </div>
                            )}
                        </div>
                    </section>
                </main>
            </div>
            <Footer/>
        </>
    );
}

export default Profile;