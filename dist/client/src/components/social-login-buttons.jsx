import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { FaGoogle, FaFacebook, FaRedditAlien } from "react-icons/fa";
export function SocialLoginButtons({ onClose }) {
    const handleSocialLogin = (provider) => {
        // Redirect to backend OAuth endpoint
        window.location.href = `/api/auth/${provider}`;
    };
    return (<div className="space-y-4">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <Separator className="w-full bg-gray-700"/>
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-gray-900 px-2 text-gray-400">Or continue with</span>
        </div>
      </div>

      <div className="grid gap-3">
        <Button variant="outline" onClick={() => handleSocialLogin('google')} className="w-full bg-gray-800 border-gray-700 hover:bg-gray-700 hover:border-purple-500 transition-all group">
          <FaGoogle className="mr-2 h-4 w-4 text-red-500 group-hover:text-red-400"/>
          <span className="text-gray-300">Continue with Google</span>
        </Button>

        <Button variant="outline" onClick={() => handleSocialLogin('facebook')} className="w-full bg-gray-800 border-gray-700 hover:bg-gray-700 hover:border-purple-500 transition-all group">
          <FaFacebook className="mr-2 h-4 w-4 text-blue-600 group-hover:text-blue-500"/>
          <span className="text-gray-300">Continue with Facebook</span>
        </Button>

        <Button variant="outline" onClick={() => handleSocialLogin('reddit')} className="w-full bg-gray-800 border-gray-700 hover:bg-gray-700 hover:border-purple-500 transition-all group">
          <FaRedditAlien className="mr-2 h-4 w-4 text-orange-600 group-hover:text-orange-500"/>
          <span className="text-gray-300">Continue with Reddit</span>
        </Button>
      </div>

      <div className="text-xs text-center text-gray-500">
        By continuing, you agree to our Terms of Service and Privacy Policy
      </div>
    </div>);
}
